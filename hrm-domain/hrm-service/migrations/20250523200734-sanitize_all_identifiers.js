/**
 * Copyright (C) 2021-2023 Technology Matters
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see https://www.gnu.org/licenses/.
 */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async queryInterface => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `
      -- Sanitize voice contacts
      -- for sip, convert 'sip:+123456789@twilio.dcthosted.net' into '+123456789'
      UPDATE "Contacts" SET "number" = regexp_replace(number, '^sip:([^@]+)@.*$', '\\1') WHERE "channel" = 'voice' AND "number" LIKE 'sip:%';
      -- remove hyphens and spaces
      UPDATE "Contacts" SET "number" = regexp_replace(number, '[-\\s]', '', 'g') WHERE "channel" = 'voice';
    `,
        { transaction },
      );
      console.log('Sanitized voice contacts');

      await queryInterface.sequelize.query(
        `
      -- Sanitize sms contacts
      -- remove hyphens and spaces
      UPDATE "Contacts" SET "number" = regexp_replace(number, '[-\\s]', '', 'g') WHERE "channel" = 'sms';
    `,
        { transaction },
      );
      console.log('Sanitized sms contacts');

      await queryInterface.sequelize.query(
        `
      -- Sanitize whatsapp contacts
      -- remove 'whatsapp:' prefix
      UPDATE "Contacts" SET "number" = replace("number", 'whatsapp:', '') WHERE "channel" = 'whatsapp' AND "number" LIKE 'whatsapp:%';
      -- remove hyphens and spaces
      UPDATE "Contacts" SET "number" = regexp_replace(number, '[-\\s]', '', 'g') WHERE "channel" = 'whatsapp';
    `,
        { transaction },
      );
      console.log('Sanitized whatsapp contacts');

      await queryInterface.sequelize.query(
        `
      -- Sanitize modica contacts
      -- remove 'modica:' prefix
      UPDATE "Contacts" SET "number" = replace("number", 'modica:', '') WHERE "channel" = 'modica' AND "number" LIKE 'modica:%';
      -- remove hyphens and spaces
      UPDATE "Contacts" SET "number" = regexp_replace(number, '[-\\s]', '', 'g') WHERE "channel" = 'modica';
    `,
        { transaction },
      );
      console.log('Sanitized modica contacts');

      await queryInterface.sequelize.query(
        `
      -- Sanitize messenger contacts
      -- remove 'messenger:' prefix
      UPDATE "Contacts" SET "number" = replace("number", 'messenger:', '') WHERE "channel" = 'messenger' AND "number" LIKE 'messenger:%';
    `,
        { transaction },
      );
      console.log('Sanitized messenger contacts');

      await queryInterface.sequelize.query(
        `
      -- Sanitize instagram contacts
      -- remove 'instagram:' prefix
      UPDATE "Contacts" SET "number" = replace("number", 'instagram:', '') WHERE "channel" = 'instagram' AND "number" LIKE 'instagram:%';
    `,
        { transaction },
      );
      console.log('Sanitized instagram contacts');

      await queryInterface.sequelize.query(
        `
      -- Sanitize telegram contacts
      -- remove 'telegram:' prefix
      UPDATE "Contacts" SET "number" = replace("number", 'telegram:', '') WHERE "channel" = 'telegram' AND "number" LIKE 'telegram:%';
    `,
        { transaction },
      );
      console.log('Sanitized telegram contacts');

      await queryInterface.sequelize.query(
        `
      -- Merge contacts with the same "number" into using the samae identifierId and profileId
      -- The chosen identifiers are the sanitized version or the minimal id if no sanitized version exists
      WITH duplicates AS (
        SELECT
          "accountSid",
          "number"
        FROM "Contacts"
        GROUP BY "accountSid", "number"
        HAVING COUNT(DISTINCT "identifierId") > 1
      ),
      candidate_identifiers AS (
        SELECT
          c."accountSid",
          c."number",
          c."identifierId",
          i."identifier" AS "rawIdentifier",
          CASE
            WHEN i."identifier" = c."number" THEN TRUE
            ELSE FALSE
          END AS "isSanitized"
        FROM "Contacts" c
        JOIN "Identifiers" i ON c."identifierId" = i."id"
        JOIN duplicates d ON d."accountSid" = c."accountSid" AND d."number" = c."number"
      ),
      resolved_identifiers AS (
        SELECT
          "accountSid",
          "number",
          -- Prefer sanitized one, fallback to min(identifierId)
          COALESCE(
            MIN("identifierId") FILTER (WHERE "isSanitized"),
            MIN("identifierId")
          ) AS "targetIdentifierId"
        FROM candidate_identifiers
        GROUP BY "accountSid", "number"
      ),
      with_target_ids AS (
        SELECT
          c."id",
          c."accountSid",
          c."number",
          c."identifierId",
          r."targetIdentifierId"
        FROM "Contacts" c
        JOIN resolved_identifiers r ON r."accountSid" = c."accountSid" AND r."number" = c."number"
        WHERE c."identifierId" <> r."targetIdentifierId"
      ),
      target_contacts AS (
        SELECT
          w."id",
          w."targetIdentifierId",
          p2i."profileId" AS "targetProfileId"
        FROM with_target_ids w
        JOIN "ProfilesToIdentifiers" p2i
          ON p2i."accountSid" = w."accountSid"
        AND p2i."identifierId" = w."targetIdentifierId"
      )
      UPDATE "Contacts" c
      SET
        "identifierId" = t."targetIdentifierId",
        "profileId" = t."targetProfileId"
      FROM target_contacts t
      WHERE c."id" = t."id";
    `,
        { transaction },
      );
      console.log('Unified matching-number contact identifierId');

      await queryInterface.sequelize.query(
        `
      -- Correct mismatched identifiers (if they were not sanitized, this will fix it)
      WITH mismatched_identifiers AS (
        SELECT
          i."id" AS "identifierId",
          MIN(c."number") AS "newNumber"
        FROM "Identifiers" i
        JOIN "Contacts" c
          ON c."accountSid" = i."accountSid"
        AND c."identifierId" = i."id"
        WHERE i."identifier" IS DISTINCT FROM c."number"
          AND c."channel" <> 'web'
        GROUP BY i."id"
      )
      UPDATE "Identifiers" i
      SET "identifier" = m."newNumber"
      FROM mismatched_identifiers m
      WHERE i."id" = m."identifierId";
    `,
        { transaction },
      );
      console.log('Fixed non-sanitized identifiers');

      await transaction.commit();
      console.log('Transaction commited');
    } catch (err) {
      await transaction.rollback();
      console.log('Transaction rollbacked');
      console.error(err);
      throw err;
    }
  },
  down: async () => {},
};

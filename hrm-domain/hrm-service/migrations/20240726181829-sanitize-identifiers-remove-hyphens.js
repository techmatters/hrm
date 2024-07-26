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
    await queryInterface.sequelize.query(`
      -- Fix the contacts for the conflicting records
      UPDATE "Contacts" SET "profileId" = sanitized."targetProfile", "identifierId" = sanitized."targetId"
      FROM (
        --- All identifiers with conflicts, plus the "target id" which is the minimal id that matches the sanitized identifier
        SELECT "main"."id" AS "conflictId", "main"."accountSid", "grouped"."targetId", "p2i"."profileId" AS "targetProfile"
        FROM "Identifiers" "main" 
        INNER JOIN (
          SELECT "idx"."accountSid", replace("idx"."identifier", '-', '') AS "sanitized", MIN("idx"."id") AS "targetId" FROM "Identifiers" "idx"
			    JOIN "Contacts" "contacts" ON "idx"."id" = "contacts"."identifierId"
          WHERE "idx"."identifier" LIKE '%-%' AND "contacts"."channel" IN ('voice', 'whatsapp', 'sms', 'modica')
			    GROUP BY "idx"."accountSid", replace("idx"."identifier", '-', '') HAVING COUNT(*) > 1
        ) "grouped" ON replace("main"."identifier", '-', '')="grouped"."sanitized" AND "main"."accountSid"="grouped"."accountSid"
        INNER JOIN "ProfilesToIdentifiers" "p2i" ON "p2i"."identifierId" = "grouped"."targetId"
        ORDER BY replace("identifier", '-', '')
      ) AS sanitized WHERE "identifierId" = sanitized."conflictId" AND "identifierId" != sanitized."targetId"
    `);
    console.log('Contacts fixed');

    await queryInterface.sequelize.query(`
      DELETE FROM "Profiles" WHERE "id" IN (
        SELECT "p2i"."profileId" AS "conflictProfileId"
        FROM (
          --- All identifiers with conflicts, plus the "target id" which is the minimal id that matches the sanitized identifier
          SELECT "main"."id" AS "conflictId", "main"."accountSid", "grouped"."targetId", "p2i"."profileId" AS "targetProfile"
          FROM "Identifiers" "main" 
          INNER JOIN (
            SELECT "idx"."accountSid", replace("idx"."identifier", '-', '') AS "sanitized", MIN("idx"."id") AS "targetId" FROM "Identifiers" "idx"
			      JOIN "Contacts" "contacts" ON "idx"."id" = "contacts"."identifierId"
          	WHERE "idx"."identifier" LIKE '%-%' AND "contacts"."channel" IN ('voice', 'whatsapp', 'sms', 'modica')
			      GROUP BY "idx"."accountSid", replace("idx"."identifier", '-', '') HAVING COUNT(*) > 1
          ) "grouped" ON replace("main"."identifier", '-', '')="grouped"."sanitized" AND "main"."accountSid"="grouped"."accountSid"
          INNER JOIN "ProfilesToIdentifiers" "p2i" ON "p2i"."identifierId" = "grouped"."targetId"
          ORDER BY replace("identifier", '-', '')
        ) AS "sanitized"
        INNER JOIN "ProfilesToIdentifiers" "p2i" ON "p2i"."identifierId" = "sanitized"."conflictId" AND "p2i"."identifierId" != "sanitized"."targetId"
      )
    `);
    console.log('Conflicting profiles deleted');

    await queryInterface.sequelize.query(`
      DELETE FROM "Identifiers" WHERE "id" IN (
        SELECT "idx"."id" AS "conflictIdentifierId"
        FROM (
          --- All identifiers with conflicts, plus the "target id" which is the minimal id that matches the sanitized identifier
          SELECT "main"."id" AS "conflictId", "grouped"."targetId"
          FROM "Identifiers" "main" 
          INNER JOIN (
            SELECT "idx"."accountSid", replace("idx"."identifier", '-', '') AS "sanitized", MIN("idx"."id") AS "targetId" FROM "Identifiers" "idx"
			      JOIN "Contacts" "contacts" ON "idx"."id" = "contacts"."identifierId"
          	WHERE "idx"."identifier" LIKE '%-%' AND "contacts"."channel" IN ('voice', 'whatsapp', 'sms', 'modica')
			      GROUP BY "idx"."accountSid", replace("idx"."identifier", '-', '') HAVING COUNT(*) > 1
          ) "grouped" ON replace("main"."identifier", '-', '')="grouped"."sanitized" AND "main"."accountSid"="grouped"."accountSid"
          ORDER BY replace("identifier", '-', '')
        ) AS "sanitized"
        INNER JOIN "Identifiers" "idx" ON "idx"."id" = "sanitized"."conflictId" AND "idx"."id" != "sanitized"."targetId"
      )
    `);
    console.log('Conflicting identifiers deleted');

    await queryInterface.sequelize.query(`
      UPDATE "Identifiers" "idx" SET "identifier" = replace("idx"."identifier", '-', '')
      FROM (
        SELECT DISTINCT identifiers.* FROM "Identifiers" identifiers
        JOIN "Contacts" contacts ON identifiers.id = contacts."identifierId"
        WHERE identifiers.identifier LIKE '%-%' AND contacts."channel" IN ('voice', 'whatsapp', 'sms', 'modica')
      ) AS "hyphened" WHERE "idx"."id" = "hyphened"."id"
    `);
    console.log('hyphened identifiers sanitized');
  },

  down: async () => {},
};

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
    await queryInterface.sequelize
      .query(`CREATE OR REPLACE FUNCTION "contactRelations"(character varying(255), bigint)
RETURNS TABLE (
  "csamReports" jsonb,
  "referrals" jsonb,
  "conversationMedia" jsonb
) AS $$
  SELECT reports."csamReports", joinedReferrals."referrals", media."conversationMedia" FROM (
    SELECT COALESCE(jsonb_agg(to_jsonb(r)), '[]') AS "csamReports"
    FROM "CSAMReports" r
    WHERE r."contactId" = $2 AND r."accountSid" = $1 AND r."acknowledged" = TRUE
  ) reports
  LEFT JOIN LATERAL (
    SELECT COALESCE(jsonb_agg(to_jsonb(referral)), '[]') AS "referrals"
    FROM "Referrals" referral
    WHERE referral."contactId" = $2 AND referral."accountSid" = $1
  ) joinedReferrals ON true
  LEFT JOIN LATERAL (
    SELECT COALESCE(jsonb_agg(to_jsonb(cm)), '[]') AS "conversationMedia"
    FROM "ConversationMedias" cm
    WHERE cm."contactId" = $2 AND cm."accountSid" = $1
  ) media ON true
$$
LANGUAGE SQL
STABLE;
    `);
    await queryInterface.sequelize
      .query(`CREATE OR REPLACE FUNCTION "permittedFullContacts"(character varying(255), character varying(255))
RETURNS TABLE (
  id integer,
  "createdAt" timestamp with time zone,
  "updatedAt" timestamp with time zone,
  "rawJson" jsonb,
  "queueName" character varying(255),
  "twilioWorkerId" character varying(255),
  helpline character varying(255),
  "number" character varying(255),
  channel character varying(255),
  "conversationDuration" integer,
  "caseId" integer,
  "accountSid" character varying(255),
  "timeOfContact" timestamp with time zone,
  "taskId" character varying(255),
  "createdBy" character varying(255),
  "channelSid" character varying(255),
  "serviceSid" character varying(255),
  "updatedBy" text,
  "csamReports" jsonb,
  "referrals" jsonb,
  "conversationMedia" jsonb
) AS $$
  SELECT c.*, relations."csamReports", relations."referrals", relations."conversationMedia"
  FROM "Contacts" c
  LEFT JOIN LATERAL "contactRelations"($1, c.id) relations ON true
  WHERE c."accountSid" = $1 AND ($2 IS NULL OR c."twilioWorkerId" = $2)
$$
LANGUAGE SQL
STABLE;
    `);
    console.log('Function "permittedFullContacts" created');
  },

  down: async queryInterface => {
    await queryInterface.sequelize.query(
      `DROP FUNCTION IF EXISTS public."permittedFullContacts"(character varying(255), character varying(255))`,
    );
    console.log('Function "permittedFullContacts" dropped');
    await queryInterface.sequelize.query(
      `DROP FUNCTION IF EXISTS public."contactRelations"(character varying(255), bigint)`,
    );
    console.log('Function "contactRelations" dropped');
  },
};

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
    await queryInterface.sequelize.query(
      `DELETE FROM "ContactJobs" WHERE "contactId" IN (SELECT id FROM "Contacts" WHERE "taskId" IN (SELECT "taskId" FROM public."Contacts" GROUP BY "taskId" HAVING COUNT(*) > 1));`,
    );
    await queryInterface.sequelize.query(
      `DELETE FROM "CSAMReports" WHERE "contactId" IN (SELECT id FROM "Contacts" WHERE "taskId" IN (SELECT "taskId" FROM public."Contacts" GROUP BY "taskId" HAVING COUNT(*) > 1));`,
    );
    await queryInterface.sequelize.query(
      `DELETE FROM "Referrals" WHERE "contactId" IN (SELECT id FROM "Contacts" WHERE "taskId" IN (SELECT "taskId" FROM public."Contacts" GROUP BY "taskId" HAVING COUNT(*) > 1));`,
    );
    await queryInterface.sequelize.query(
      `DELETE FROM "ConversationMedias" WHERE "contactId" IN (SELECT id FROM "Contacts" WHERE "taskId" IN (SELECT "taskId" FROM public."Contacts" GROUP BY "taskId" HAVING COUNT(*) > 1));`,
    );
    await queryInterface.sequelize.query(
      `DELETE FROM "Contacts" WHERE "taskId" IN (SELECT "taskId" FROM public."Contacts" GROUP BY "taskId" HAVING COUNT(*) > 1);`,
    );
    console.log('Cleared out contacts with duplicate taskIds');
    await queryInterface.sequelize
      .query(`CREATE UNIQUE INDEX IF NOT EXISTS "Contacts_taskId_idx"
                  ON public."Contacts" USING btree
                  ("taskId" COLLATE pg_catalog."default" ASC NULLS LAST, "accountSid" COLLATE pg_catalog."default" ASC NULLS LAST)
                  TABLESPACE pg_default`);
    console.log('TaskId unique index created');
  },

  down: async queryInterface => {
    await queryInterface.sequelize.query(
      `DROP INDEX IF EXISTS public."Contacts_taskId_idx"`,
    );
    console.log('TaskId unique index dropped');
  },
};

"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteJobsByContactId = exports.deleteContactById = exports.cleanupReferrals = exports.cleanupCsamReports = exports.cleanupContactsJobs = exports.cleanupContacts = exports.cleanupCases = void 0;
const dbConnection_1 = require("../dbConnection");
const mocks_1 = require("../mocks");
const cleanupWhereClause = `
  WHERE "twilioWorkerId" IN ('fake-worker-123', 'fake-worker-129', 'fake-worker-987', '${mocks_1.workerSid}') OR "accountSid" IN ('', '${mocks_1.accountSid}');
`;
const cleanupCases = () => dbConnection_1.db.task(t => t.none(`
      DELETE FROM "Cases"
      ${cleanupWhereClause}
  `));
exports.cleanupCases = cleanupCases;
const cleanupContacts = () => dbConnection_1.db.task(t => t.none(`
      DELETE FROM "Contacts"
      ${cleanupWhereClause}
  `));
exports.cleanupContacts = cleanupContacts;
const cleanupContactsJobs = () => dbConnection_1.db.task(t => t.none(`
      DELETE FROM "ContactJobs"
      WHERE "accountSid" IN ('', '${mocks_1.accountSid}')
  `));
exports.cleanupContactsJobs = cleanupContactsJobs;
const cleanupCsamReports = () => dbConnection_1.db.task(t => t.none(`
      DELETE FROM "CSAMReports"
      ${cleanupWhereClause}
    `));
exports.cleanupCsamReports = cleanupCsamReports;
const cleanupReferrals = () => dbConnection_1.db.task(t => t.none(`
      DELETE FROM "CSAMReports"
      ${cleanupWhereClause}
    `)); // eslint-disable-next-line @typescript-eslint/no-shadow
exports.cleanupReferrals = cleanupReferrals;
const deleteContactById = (id, accountSid) => dbConnection_1.db.task(t => t.none(`
      DELETE FROM "Contacts"
      WHERE "id" = ${id} AND "accountSid" = '${accountSid}';
  `)); // eslint-disable-next-line @typescript-eslint/no-shadow
exports.deleteContactById = deleteContactById;
const deleteJobsByContactId = (contactId, accountSid) => dbConnection_1.db.task(t => t.manyOrNone(`
      DELETE FROM "ContactJobs"
      WHERE "contactId" = ${contactId} AND "accountSid" = '${accountSid}';
    `));
exports.deleteJobsByContactId = deleteJobsByContactId;

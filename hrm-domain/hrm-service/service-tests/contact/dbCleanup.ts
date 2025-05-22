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

import { db } from '../dbConnection';
import { accountSid, workerSid } from '../mocks';

const cleanupWhereClause = `
  WHERE "twilioWorkerId" IN ('fake-worker-123', 'fake-worker-129', 'fake-worker-987', '${workerSid}') OR "accountSid" IN ('', '${accountSid}');
`;
export const cleanupCases = () =>
  db.task(t =>
    t.none(`
      DELETE FROM "Cases"
      ${cleanupWhereClause}
  `),
  );
export const cleanupContacts = () =>
  db.task(t =>
    t.none(`
      DELETE FROM "Contacts"
      ${cleanupWhereClause}
  `),
  );
export const cleanupContactsJobs = () =>
  db.task(t =>
    t.none(`
      DELETE FROM "ContactJobs"
      WHERE "accountSid" IN ('', '${accountSid}')
  `),
  );
export const cleanupCsamReports = () =>
  db.task(t =>
    t.none(`
      DELETE FROM "CSAMReports"
      ${cleanupWhereClause}
    `),
  );
export const cleanupReferrals = () =>
  db.task(t =>
    t.none(`
      DELETE FROM "CSAMReports"
      ${cleanupWhereClause}
    `),
  ); // eslint-disable-next-line @typescript-eslint/no-shadow
export const deleteContactById = (id: number, accountSid: string) =>
  db.task(t =>
    t.none(`
      DELETE FROM "Contacts"
      WHERE "id" = ${id} AND "accountSid" = '${accountSid}';
  `),
  ); // eslint-disable-next-line @typescript-eslint/no-shadow
export const deleteJobsByContactId = (contactId: number, accountSid: string) =>
  db.task(t =>
    t.manyOrNone(`
      DELETE FROM "ContactJobs"
      WHERE "contactId" = ${contactId} AND "accountSid" = '${accountSid}';
    `),
  );

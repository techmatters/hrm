import { db } from '../../src/connection-pool';
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

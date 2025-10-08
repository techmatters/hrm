import { db } from '../../src/connection-pool';

export const clearDb = async () => {
  await db.none(`
     TRUNCATE resources."ResourceReferenceStringAttributeValues" CASCADE;
      `);
  await db.none(`
     TRUNCATE resources."Resources" CASCADE;
      `);
  await db.none(`
     TRUNCATE resources."Accounts";
      `);
};

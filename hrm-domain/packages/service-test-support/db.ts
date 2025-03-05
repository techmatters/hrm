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
import { IDatabase } from 'pg-promise';

export const clearAllTables = async (db: IDatabase<unknown>) => {
  try {
    await Promise.all([
      db.none('DELETE FROM "public"."ConversationMedias"'),
      db.none('DELETE FROM "public"."ContactJobs"'),
      db.none('DELETE FROM "public"."ProfilesToProfileFlags"'),
      db.none('DELETE FROM "public"."ProfilesToIdentifiers"'),
      db.none('DELETE FROM "public"."ProfileSections"'),
      db.none('DELETE FROM "public"."CSAMReports"'),
    ]);
    await db.none('DELETE FROM "public"."Contacts"');
    await Promise.all([
      db.none('DELETE FROM "public"."Identifiers"'),
      db.none('DELETE FROM "public"."Cases"'),
      db.none('DELETE FROM "public"."Profiles"'),
    ]);
  } catch (err) {
    // Try to log out slightly more helpful error output if it's an AggregateError
    if (err instanceof AggregateError) {
      console.error(err);
      err.errors.forEach(e => console.error(e));
    } else {
      console.error(JSON.stringify(err));
    }
    throw err;
  }
};

export const waitForDb = async (db: IDatabase<unknown>) => {
  while (true) {
    try {
      const {} = await db.one('SELECT 1');
      return;
    } catch (err) {
      console.error('Database not ready, retrying in 1s');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
};

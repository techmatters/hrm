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
import { db } from '@tech-matters/hrm-core/connection-pool';

export const clearAllTables = async () => {
  await Promise.all([
    db.none('DELETE FROM "public"."ContactJobs"'),
    db.none('DELETE FROM "public"."ProfilesToProfileFlags"'),
    db.none('DELETE FROM "public"."ProfilesToIdentifiers"'),
    db.none('DELETE FROM "public"."ProfileSections"'),
  ]);
  await Promise.all([
    db.none('DELETE FROM "public"."Identifiers"'),
    db.none('DELETE FROM "public"."Contacts"'),
  ]);
  await Promise.all([
    db.none('DELETE FROM "public"."Cases"'),
    db.none('DELETE FROM "public"."Profiles"'),
  ]);
};

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

const WHERE_IDENTIFIER_CLAUSE =
  'WHERE "accountSid" = $<accountSid> AND "identifier" = $<identifier>';

// export const lookupIdentifierSql = `
//   SELECT * FROM "Identifiers"
//   ${WHERE_IDENTIFIER_CLAUSE}
// `;

export const joinProfilesIdentifiersSql = `
SELECT "identifierId", "profileId" FROM 
 (
    SELECT * FROM "Identifiers"
    ${WHERE_IDENTIFIER_CLAUSE}
  ) AS ids
  LEFT JOIN "ProfilesToIdentifiers" p2i ON ids.id = p2i."identifierId" AND ids."accountSid" = p2i."accountSid"
  LEFT JOIN "Profiles" profiles ON profiles.id = p2i."profileId" AND profiles."accountSid" = p2i."accountSid";
`;

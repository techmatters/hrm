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

export type CommonParams = {
  accountSid: string;
};

export type JwtGrant = {
  permissions: string[];
};

export type Jwt = {
  sub: string; // The subject of the JWT (i.e., the user or entity that is being authenticated).
  exp: number; // The expiration time for the JWT.
  iss: string; // The entity that issued the JWT.
  grant: JwtGrant;
};

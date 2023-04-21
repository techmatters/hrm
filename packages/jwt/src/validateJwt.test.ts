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

import { generateJwt } from './generateJwt';
import { validateJwt } from './validateJwt';

const accountSid = 'mockAccountSid';
const authToken = 'mockAuthToken';
const grants = {
  worker_sid: 'mockWorkerSid',
  roles: ['mockRole'],
};

describe('validateJwt', () => {
  let token: string;
  beforeAll(() => {
    token = generateJwt({ accountSid, authToken, grants });
  });

  it('validateJwt should generate a valid JWT', () => {
    const returnedGrants = validateJwt({ accountSid, authToken, token });

    expect(returnedGrants).toEqual(grants);
  });

  it('validateJwt should return false if the JWT is invalid', () => {
    const returnedGrants = validateJwt({ accountSid, authToken: 'invalid', token });

    expect(returnedGrants).toEqual(false);
  });
});

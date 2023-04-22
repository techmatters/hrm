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
const permissions = ['mockPermission'];
const issuer = 'mockIssuer';

process.env.TWILIO_AUTH_TOKEN_mockAccountSid = 'mockAuthToken';
process.env.INTERNAL_JWT_TOKEN_SECRET = 'mockInternalToken';

describe('validateJwt', () => {
  let token: string;
  beforeAll(async () => {
    token = await generateJwt({ accountSid, issuer, permissions });
  });

  it('validateJwt should generate a valid JWT', async () => {
    const resp = await validateJwt({ accountSid, token });

    expect(resp.success).toEqual(true);
    expect(resp.grant!.permissions).toEqual(permissions);
  });

  it('validateJwt should return false if the JWT is invalid', async () => {
    const resp = await validateJwt({ accountSid: 'badAccountSid', token });

    expect(resp.success).toEqual(false);
    expect(resp.message).toEqual('Error decoding JWT: JsonWebTokenError: invalid signature');
  });
});

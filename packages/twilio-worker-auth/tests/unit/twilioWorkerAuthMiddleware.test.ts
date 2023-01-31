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

import { twilioUser } from '../../src';

const tftv = require('twilio-flex-token-validator');
import each from 'jest-each';
import { getAuthorizationMiddleware } from '../../src';
import { unauthorized } from '@tech-matters/http';

jest.mock('@tech-matters/http', () => ({
  unauthorized: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

const mockUnauthorized = unauthorized as jest.Mock<ReturnType<typeof unauthorized>>;

describe('Test Bearer token', () => {
  each([
    {
      description: 'token is valid and tokenResult satisfies the constraints',
      shouldAuthorize: true,
      validatorImplementation: async () => ({
        worker_sid: 'WKxxxxxxxxxxx',
        roles: ['agent'],
      }),
    },
    {
      description: 'token is valid but worker sid is missing',
      shouldAuthorize: false,
      validatorImplementation: async () => ({
        worker_sid: null,
        roles: ['agent'],
      }),
    },
    {
      description: 'token is valid but worker sid is not prefixed with WK',
      shouldAuthorize: false,
      validatorImplementation: async () => ({
        worker_sid: 'xxxxxxxxxxx',
        roles: ['agent'],
      }),
    },
    {
      description: 'token is valid but has guest role',
      shouldAuthorize: false,
      validatorImplementation: async () => ({
        worker_sid: 'WKxxxxxxxxxxx',
        roles: ['guest', 'agent'],
      }),
    },
    {
      description: 'authorization header is missing',
      shouldAuthorize: false,
      validatorImplementation: async () => {}, // won't reach even this
    },
    {
      description: 'missing credentials (no authToken for given accountSid)',
      shouldAuthorize: false,
      validatorImplementation: async () => {}, // won't reach even this
      authTokenLookup: () => undefined,
    },
  ]).test(
    `Should authorize: $shouldAuthorize when $description`,
    async ({
      shouldAuthorize,
      validatorImplementation,
      authTokenLookup = () => 'picernic basket',
      headers = { authorization: 'Bearer some-very-valid-worker-token' },
    }) => {
      const authorizationMiddleware = getAuthorizationMiddleware(authTokenLookup);

      const nextFn = jest.fn();

      const mockedReq: any = {
        headers,
        accountSid: `MOCKED_ACCOUNT`,
      };

      const mockedRes: any = {
        _status: undefined,
      };
      mockedRes.status = (statusCode: number) => {
        mockedRes._status = statusCode;
        return mockedRes;
      };
      mockedRes.json = jest.fn();

      jest.spyOn(tftv, 'validator').mockImplementationOnce(validatorImplementation);
      mockUnauthorized.mockReturnValue({ error: 'Geroutofit' });

      const result = await authorizationMiddleware(mockedReq, mockedRes, nextFn);

      if (shouldAuthorize) {
        expect(nextFn).toHaveBeenCalled();
        expect(unauthorized).not.toHaveBeenCalled();
        expect(result).toBe(undefined);
        const tokenResult = await validatorImplementation();
        expect(mockedReq.user).toMatchObject(twilioUser(tokenResult.worker_sid, tokenResult.roles));
      } else {
        expect(nextFn).not.toHaveBeenCalled();
        expect(unauthorized).toHaveBeenCalled();
        expect(result).toMatchObject(unauthorized(mockedRes));
      }
    },
  );
});

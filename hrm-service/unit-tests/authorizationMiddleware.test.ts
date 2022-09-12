const tftv = require('twilio-flex-token-validator');
import each from 'jest-each';
import { getAuthorizationMiddleware } from '../src/middlewares';
import { User } from '../src/permissions';
import utils, { unauthorized } from '../src/utils';

beforeEach(() => {
  jest.clearAllMocks();
});

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
      const unauthorizedSpy = jest.spyOn(utils, 'unauthorized');

      const result = await authorizationMiddleware(mockedReq, mockedRes, nextFn);

      if (shouldAuthorize) {
        expect(nextFn).toHaveBeenCalled();
        expect(unauthorizedSpy).not.toHaveBeenCalled();
        expect(result).toBe(undefined);
        const tokenResult = await validatorImplementation();
        expect(mockedReq.user).toMatchObject(new User(tokenResult.worker_sid, tokenResult.roles));
      } else {
        expect(nextFn).not.toHaveBeenCalled();
        expect(unauthorizedSpy).toHaveBeenCalled();
        expect(mockedRes._status).toBe(401);
        expect(mockedRes.json).toHaveBeenCalled();
        expect(result).toMatchObject(unauthorized(mockedRes));
      }
    },
  );
});

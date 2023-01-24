import { user } from '../../src';

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
        expect(mockedReq.user).toMatchObject(user(tokenResult.worker_sid, tokenResult.roles));
      } else {
        expect(nextFn).not.toHaveBeenCalled();
        expect(unauthorized).toHaveBeenCalled();
        expect(result).toMatchObject(unauthorized(mockedRes));
      }
    },
  );
});

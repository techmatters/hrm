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

import { Request, Response } from 'express';
import referralRoutes from '../../referral/referral-routes-v0';
import { createReferral } from '../../referral/referralService';
import {
  DuplicateReferralError,
  OrphanedReferralError,
  Referral,
} from '../../referral/referralDataAccess';
import { subHours } from 'date-fns';
import { SafeRouter } from '../../permissions';
import { AssertionError } from 'assert';

jest.mock('../../permissions', () => ({
  SafeRouter: jest.fn(),
}));

jest.mock('../../referral/referralService', () => ({
  createReferral: jest.fn(),
}));

const mockSafeRouter = SafeRouter as jest.Mock;
const mockCreateReferral = createReferral as jest.Mock<() => Promise<Referral>>;

beforeEach(() => {
  mockSafeRouter.mockReset();
  mockCreateReferral.mockReset();
});

describe('POST /search', () => {
  type ReferralRequestHandler = (req: Request<Referral>, res: Response) => Promise<void>;

  const hourAgo = subHours(new Date(), 1);

  const validReferral = {
    contactId: '1234',
    resourceId: 'TEST_RESOURCE',
    referredAt: hourAgo.toISOString(),
    resourceName: 'A test referred resource',
  };

  let createReferralRequestHandler: ReferralRequestHandler;
  const response: Response = { json: jest.fn() } as any;
  const mockResponseJson = response.json as jest.Mock;

  beforeEach(() => {
    mockResponseJson.mockReset();
    mockSafeRouter.mockImplementation(() => ({
      post: (path: string, publicEndpoint: string, handler: ReferralRequestHandler) => {
        if (path === '/') {
          createReferralRequestHandler = handler;
        }
      },
      get: () => {},
    }));
    referralRoutes();
  });

  test('Passes referral from body and accountSid from request down to model', async () => {
    const innerCreateReferral = jest.fn(() => Promise.resolve(validReferral));
    mockCreateReferral.mockReturnValueOnce(innerCreateReferral);
    await createReferralRequestHandler(
      {
        body: validReferral,
        accountSid: 'AC1',
        hrmAccountId: 'AC1',
      } as any,
      response,
    );
    expect(innerCreateReferral).toHaveBeenCalledWith('AC1', validReferral);
    expect(response.json).toHaveBeenCalledWith(validReferral);
  });

  test('referredAt date not in ISO format - throws 400', async () => {
    try {
      await createReferralRequestHandler(
        {
          body: { ...validReferral, referredAt: hourAgo.toString() },
          accountSid: 'AC1',
          hrmAccountId: 'AC1',
        } as any,
        response,
      );
    } catch (err) {
      expect(err.status).toBe(400);
      return;
    }
    throw new AssertionError({ message: 'createReferral handler should have thrown' });
  });

  test('referredAt date missing- throws 400', async () => {
    try {
      await createReferralRequestHandler(
        {
          body: { ...validReferral, referredAt: undefined },
          accountSid: 'AC1',
          hrmAccountId: 'AC1',
        } as any,
        response,
      );
    } catch (err) {
      expect(err.status).toBe(400);
      return;
    }
    throw new AssertionError({ message: 'createReferral handler should have thrown' });
  });

  test('contact id missing- throws 400', async () => {
    try {
      await createReferralRequestHandler(
        {
          body: { ...validReferral, contactId: undefined },
          accountSid: 'AC1',
          hrmAccountId: 'AC1',
        } as any,
        response,
      );
    } catch (err) {
      expect(err.status).toBe(400);
      return;
    }
    throw new AssertionError({ message: 'createReferral handler should have thrown' });
  });

  test('resource id missing- throws 400', async () => {
    try {
      await createReferralRequestHandler(
        {
          body: { ...validReferral, resourceId: undefined },
          accountSid: 'AC1',
          hrmAccountId: 'AC1',
        } as any,
        response,
      );
    } catch (err) {
      expect(err.status).toBe(400);
      return;
    }
    throw new AssertionError({ message: 'createReferral handler should have thrown' });
  });

  test('No name - passes referral from body and accountSid from request down to model', async () => {
    const { resourceName, ...rest } = validReferral;
    const innerCreateReferral = jest.fn(() => Promise.resolve(rest as Referral));

    mockCreateReferral.mockReturnValueOnce(innerCreateReferral);
    await createReferralRequestHandler(
      {
        body: rest,
        accountSid: 'AC1',
        hrmAccountId: 'AC1',
      } as any,
      response,
    );
    expect(innerCreateReferral).toHaveBeenCalledWith('AC1', rest);
    expect(response.json).toHaveBeenCalledWith(rest);
  });

  test('model throws orphaned referral error - throws 404', async () => {
    const innerCreateReferral = jest.fn(() =>
      Promise.reject(new OrphanedReferralError(validReferral.contactId, new Error())),
    );

    mockCreateReferral.mockReturnValueOnce(innerCreateReferral);
    try {
      await createReferralRequestHandler(
        {
          body: { ...validReferral, resource: undefined },
          accountSid: 'AC1',
          hrmAccountId: 'AC1',
        } as any,
        response,
      );
    } catch (err) {
      expect(err.status).toBe(404);
      return;
    }
    throw new AssertionError({ message: 'createReferral handler should have thrown' });
  });

  test('model throws duplicate referral error - throws 400', async () => {
    const innerCreateReferral = jest.fn(() =>
      Promise.reject(new DuplicateReferralError(new Error())),
    );

    mockCreateReferral.mockReturnValueOnce(innerCreateReferral);

    try {
      await createReferralRequestHandler(
        {
          body: { ...validReferral, resource: undefined },
          accountSid: 'AC1',
          hrmAccountId: 'AC1',
        } as any,
        response,
      );
    } catch (err) {
      expect(err.status).toBe(400);
      return;
    }
    throw new AssertionError({ message: 'createReferral handler should have thrown' });
  });
});

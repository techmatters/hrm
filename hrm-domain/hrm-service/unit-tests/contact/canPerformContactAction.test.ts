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

import { parseISO, subHours } from 'date-fns';
import { ContactBuilder } from './contact-builder';
import { getClient } from '@tech-matters/twilio-client';
import { isTwilioTaskTransferTarget } from '@tech-matters/twilio-client/isTwilioTaskTransferTarget';
import { getContactById, PatchPayload } from '../../src/contact/contactService';
import createError from 'http-errors';
import { canPerformEditContactAction } from '../../src/contact/canPerformContactAction';

jest.mock('@tech-matters/twilio-client', () => ({
  getClient: jest.fn().mockResolvedValue({}),
}));
jest.mock('http-errors', () => jest.fn());
jest.mock('@tech-matters/twilio-client/isTwilioTaskTransferTarget', () => ({
  isTwilioTaskTransferTarget: jest.fn(),
}));
jest.mock('../../src/contact/contactService', () => ({
  getContactById: jest.fn(),
}));
jest.mock('../../src/case/caseService', () => ({
  getCase: jest.fn(),
}));

const mockGetContactById = getContactById as jest.MockedFunction<typeof getContactById>;
const mockCreateError = createError as jest.MockedFunction<typeof createError>;
const mockIsTwilioTaskTransferTarget = isTwilioTaskTransferTarget as jest.MockedFunction<
  typeof isTwilioTaskTransferTarget
>;
const BASELINE_DATE = parseISO('2022-05-05 12:00:00');

describe('canPerformEditContactAction', () => {
  let req: any;
  const next = jest.fn();

  beforeEach(() => {
    req = {
      isAuthorized: jest.fn().mockReturnValue(false),
      params: { contactId: 'contact1' },
      authorize: jest.fn(),
      unauthorize: jest.fn(),
      can: jest.fn(),
      user: { workerSid: 'worker1' },
      accountSid: 'account1',
      body: {},
    };
    next.mockClear();
    mockGetContactById.mockClear();
    mockCreateError.mockClear();
  });

  test("Request is already authorized - doesn't authorize or unauthorize", async () => {
    req.isAuthorized.mockReturnValue(true);
    await canPerformEditContactAction(req, {}, next);
    expect(req.authorize).not.toHaveBeenCalled();
    expect(req.unauthorize).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  test('Request is not already authorized - looks up contact using contactID parameter', async () => {
    req.can.mockReturnValue(false);
    mockGetContactById.mockResolvedValue(
      new ContactBuilder().withFinalizedAt(BASELINE_DATE).build(),
    );
    await canPerformEditContactAction(req, {}, next);
    expect(mockGetContactById).toHaveBeenCalledWith(req.accountSid, 'contact1', req);
    expect(req.authorize).not.toHaveBeenCalled();
    expect(req.unauthorize).toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  describe('finalized contact', function () {
    const validFinalizedContactPatchPayload: PatchPayload = {
      rawJson: {
        callType: '',
        categories: {
          category1: ['value1'],
        },
        childInformation: { a: '1' },
        caseInformation: { a: '1' },
        callerInformation: { a: '1' },
        contactlessTask: {},
      },
      referrals: [
        {
          resourceId: 'resource1',
          resourceName: 'Resource 1',
          referredAt: subHours(BASELINE_DATE, 1).toISOString(),
        },
      ],
    };

    beforeEach(() => {
      mockGetContactById.mockResolvedValue(
        new ContactBuilder().withFinalizedAt(BASELINE_DATE).build(),
      );
    });

    test('Modifying rawJson / resource referrals and can returns true - authorizes', async () => {
      req.body = validFinalizedContactPatchPayload;
      req.can.mockReturnValue(true);
      await canPerformEditContactAction(req, {}, next);
      expect(createError).not.toHaveBeenCalled();
      expect(req.authorize).toHaveBeenCalled();
      expect(req.unauthorize).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    test('Modifying values other than rawJson / resource referrals and can returns true - unauthorizes', async () => {
      req.body = { ...validFinalizedContactPatchPayload, conversationDuration: 100 };
      req.can.mockReturnValue(true);
      await canPerformEditContactAction(req, {}, next);
      expect(createError).not.toHaveBeenCalled();
      expect(req.authorize).not.toHaveBeenCalled();
      expect(req.unauthorize).toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    test('Modifying rawJson / resource referrals and can returns false - unauthorizes', async () => {
      req.body = validFinalizedContactPatchPayload;
      req.can.mockReturnValue(false);
      await canPerformEditContactAction(req, {}, next);
      expect(createError).not.toHaveBeenCalled();
      expect(req.authorize).not.toHaveBeenCalled();
      expect(req.unauthorize).toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });
  });
  describe('draft contact', function () {
    beforeEach(() => {
      // Draft contact authorization doesn't care about the can response, so always return false
      req.can.mockReturnValue(false);
      req.body = { conversationDuration: 123 };
      req.user = { workerSid: 'thisWorker' };
      process.env.TWILIO_AUTH_TOKEN_account1 = 'account1 token';
    });

    test('Request user matches contact creator - authorizes', async () => {
      mockGetContactById.mockResolvedValue(
        new ContactBuilder()
          .withCreatedBy('thisWorker')
          .withTwilioWorkerId('otherWorker')
          .build(),
      );
      await canPerformEditContactAction(req, {}, next);
      expect(createError).not.toHaveBeenCalled();
      expect(req.authorize).toHaveBeenCalled();
      expect(req.unauthorize).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    test('Request user matches contact owner - authorizes', async () => {
      mockGetContactById.mockResolvedValue(
        new ContactBuilder()
          .withCreatedBy('otherWorker')
          .withTwilioWorkerId('thisWorker')
          .build(),
      );
      await canPerformEditContactAction(req, {}, next);
      expect(createError).not.toHaveBeenCalled();
      expect(req.authorize).toHaveBeenCalled();
      expect(req.unauthorize).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    test('Request user is not the owner or the creator, but is the target of a transfer - authorizes', async () => {
      mockGetContactById.mockResolvedValue(
        new ContactBuilder()
          .withCreatedBy('otherWorker')
          .withTwilioWorkerId('otherWorker')
          .withTaskId('original task')
          .build(),
      );
      req.body.taskId = 'transfer task';
      mockIsTwilioTaskTransferTarget.mockResolvedValue(true);
      await canPerformEditContactAction(req, {}, next);
      expect(getClient).toHaveBeenCalledWith({
        accountSid: 'account1',
        authToken: 'account1 token',
      });
      expect(isTwilioTaskTransferTarget).toHaveBeenCalledWith(
        await getClient({ accountSid: 'account1' }),
        'transfer task',
        'original task',
        'thisWorker',
      );
      expect(createError).not.toHaveBeenCalled();
      expect(req.authorize).toHaveBeenCalled();
      expect(req.unauthorize).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });
  });
  test('Request user is not the owner or the creator, nor target of a transfer - unauthorizes', async () => {
    mockGetContactById.mockResolvedValue(
      new ContactBuilder()
        .withCreatedBy('otherWorker')
        .withTwilioWorkerId('otherWorker')
        .withTaskId('original task')
        .build(),
    );
    req.body.taskId = 'transfer task';
    mockIsTwilioTaskTransferTarget.mockResolvedValue(false);
    await canPerformEditContactAction(req, {}, next);
    expect(getClient).toHaveBeenCalledWith({
      accountSid: 'account1',
      authToken: 'account1 token',
    });
    expect(isTwilioTaskTransferTarget).toHaveBeenCalledWith(
      await getClient({ accountSid: 'account1' }),
      'transfer task',
      'original task',
      'thisWorker',
    );
    expect(createError).not.toHaveBeenCalled();
    expect(req.authorize).not.toHaveBeenCalled();
    expect(req.unauthorize).toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });
});

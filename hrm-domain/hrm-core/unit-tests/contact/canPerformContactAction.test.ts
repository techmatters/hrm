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
import { isTwilioTaskTransferTarget } from '@tech-matters/twilio-client';
import { getContactById, PatchPayload } from '../../contact/contactService';
import createError from 'http-errors';
import {
  canDisconnectContact,
  canPerformEditContactAction,
} from '../../contact/canPerformContactAction';
import { CaseService, getCase } from '../../case/caseService';
import { actionsMaps } from '../../permissions';

jest.mock('@tech-matters/twilio-client', () => ({
  getClient: jest.fn().mockResolvedValue({}),
  isTwilioTaskTransferTarget: jest.fn(),
}));
jest.mock('http-errors', () => jest.fn());
jest.mock('../../contact/contactService', () => ({
  getContactById: jest.fn(),
}));
jest.mock('../../case/caseService', () => ({
  getCase: jest.fn(),
}));

const mockGetContactById = getContactById as jest.MockedFunction<typeof getContactById>;
const mockGetCase = getCase as jest.MockedFunction<typeof getCase>;
const mockCreateError = createError as jest.MockedFunction<typeof createError>;
const mockIsTwilioTaskTransferTarget = isTwilioTaskTransferTarget as jest.MockedFunction<
  typeof isTwilioTaskTransferTarget
>;
const BASELINE_DATE = parseISO('2022-05-05 12:00:00');
const accountSid1 = 'ACtwilio-hrm1';
const thisWorkerSid = 'WK-thisWorker';
const otherWorkerSid = 'WK-otherWorker';

let req: any;
const next = jest.fn();

beforeEach(() => {
  req = {
    isAuthorized: jest.fn().mockReturnValue(false),
    params: { contactId: 'contact1' },
    authorize: jest.fn(),
    unauthorize: jest.fn(),
    can: jest.fn(),
    user: { workerSid: 'WK-worker1', accountSid: 'ACtwilio' },
    hrmAccountId: accountSid1,
    body: {},
  };
  next.mockClear();
  mockGetContactById.mockClear();
  mockCreateError.mockClear();
  mockGetCase.mockClear();
});

const expectNoop = () => {
  expect(createError).not.toHaveBeenCalled();
  expect(req.authorize).not.toHaveBeenCalled();
  expect(req.unauthorize).not.toHaveBeenCalled();
  expect(next).toHaveBeenCalled();
};

const expectToBeAuthorized = () => {
  expect(createError).not.toHaveBeenCalled();
  expect(req.authorize).toHaveBeenCalled();
  expect(req.unauthorize).not.toHaveBeenCalled();
  expect(next).toHaveBeenCalled();
};

const expectToBeUnuthorized = () => {
  expect(createError).not.toHaveBeenCalled();
  expect(req.authorize).not.toHaveBeenCalled();
  expect(req.unauthorize).toHaveBeenCalled();
  expect(next).toHaveBeenCalled();
};

const draftContactTests =
  (expectToAuthorize: boolean, setup: () => Promise<void> = () => Promise.resolve()) =>
  () => {
    const expectedDescription = expectToAuthorize ? 'authorizes' : 'unauthorizes';
    const expectation = expectToAuthorize ? expectToBeAuthorized : expectToBeUnuthorized;
    beforeEach(async () => {
      // Draft contact authorization doesn't care about the can response, so always return false
      req.can.mockReturnValue(false);
      req.body = { conversationDuration: 123 };
      req.user = { accountSid: 'ACtwilio', workerSid: thisWorkerSid };
      process.env.TWILIO_AUTH_TOKEN_ACtwilio = 'account1 token';
      await setup();
    });

    test(`Request user matches contact creator - ${expectedDescription}`, async () => {
      mockGetContactById.mockResolvedValue(
        new ContactBuilder()
          .withCreatedBy(thisWorkerSid)
          .withTwilioWorkerId(otherWorkerSid)
          .build(),
      );
      await canPerformEditContactAction(req, {}, next);
      expectation();
    });

    test(`Request user matches contact owner - ${expectedDescription}`, async () => {
      mockGetContactById.mockResolvedValue(
        new ContactBuilder()
          .withCreatedBy(otherWorkerSid)
          .withTwilioWorkerId(thisWorkerSid)
          .build(),
      );
      await canPerformEditContactAction(req, {}, next);
      expectation();
    });

    test(`Request user is not the owner or the creator, but is the target of a transfer - ${expectedDescription}`, async () => {
      mockGetContactById.mockResolvedValue(
        new ContactBuilder()
          .withCreatedBy(otherWorkerSid)
          .withTwilioWorkerId(otherWorkerSid)
          .withTaskId('original task')
          .build(),
      );
      req.body.taskId = 'transfer task';
      mockIsTwilioTaskTransferTarget.mockResolvedValue(true);
      await canPerformEditContactAction(req, {}, next);
      expect(getClient).toHaveBeenCalledWith({
        accountSid: 'ACtwilio',
        authToken: 'account1 token',
      });
      expect(isTwilioTaskTransferTarget).toHaveBeenCalledWith(
        await getClient({ accountSid: accountSid1 }),
        'transfer task',
        'original task',
        thisWorkerSid,
      );
      expectation();
    });

    test('Request user is not the owner or the creator, nor target of a transfer - unauthorizes', async () => {
      mockGetContactById.mockResolvedValue(
        new ContactBuilder()
          .withCreatedBy(otherWorkerSid)
          .withTwilioWorkerId(otherWorkerSid)
          .withTaskId('original task')
          .build(),
      );
      req.body.taskId = 'transfer task';
      mockIsTwilioTaskTransferTarget.mockResolvedValue(false);
      await canPerformEditContactAction(req, {}, next);
      expect(getClient).toHaveBeenCalledWith({
        accountSid: 'ACtwilio',
        authToken: 'account1 token',
      });
      expect(isTwilioTaskTransferTarget).toHaveBeenCalledWith(
        await getClient({ accountSid: accountSid1 }),
        'transfer task',
        'original task',
        thisWorkerSid,
      );
      expectToBeUnuthorized();
    });
  };
describe('canPerformEditContactAction', () => {
  test("Request is already authorized - doesn't authorize or unauthorize", async () => {
    req.isAuthorized.mockReturnValue(true);
    await canPerformEditContactAction(req, {}, next);
    expectNoop();
  });

  test('Request is not already authorized - looks up contact using contactID parameter', async () => {
    req.can.mockReturnValue(false);
    mockGetContactById.mockResolvedValue(
      new ContactBuilder().withFinalizedAt(BASELINE_DATE).build(),
    );
    await canPerformEditContactAction(req, {}, next);
    expect(mockGetContactById).toHaveBeenCalledWith(req.hrmAccountId, 'contact1', req);
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
      expectToBeAuthorized();
    });

    test('Modifying values other than rawJson / resource referrals and can returns true - unauthorizes', async () => {
      req.body = { ...validFinalizedContactPatchPayload, conversationDuration: 100 };
      req.can.mockReturnValue(true);
      await canPerformEditContactAction(req, {}, next);
      expectToBeUnuthorized();
    });

    test('Modifying rawJson / resource referrals and can returns false - unauthorizes', async () => {
      req.body = validFinalizedContactPatchPayload;
      req.can.mockReturnValue(false);
      await canPerformEditContactAction(req, {}, next);
      expectToBeUnuthorized();
    });
  });
  describe('draft contact', draftContactTests(true));
});

describe('canDisconnectContact', () => {
  test('Request is already authorized - skips authorization', async () => {
    req.isAuthorized.mockReturnValue(true);
    await canDisconnectContact(req, {}, next);
    expectNoop();
  });

  describe('finalized contact', function () {
    let contact = new ContactBuilder().withFinalizedAt(BASELINE_DATE).build();
    beforeEach(() => {
      mockGetContactById.mockResolvedValue(contact);
      contact.caseId = '123';
    });
    test('can returns true to authorize & case id not set on contact - authorizes', async () => {
      delete contact.caseId;
      req.can.mockImplementation(
        (user, action) => action === actionsMaps.contact.REMOVE_CONTACT_FROM_CASE,
      );
      await canDisconnectContact(req, {}, next);
      expect(req.can).toHaveBeenCalledWith(
        req.user,
        actionsMaps.contact.REMOVE_CONTACT_FROM_CASE,
        contact,
      );
      expectToBeAuthorized();
    });

    test('can returns true to authorize & case not found to disconnect from - authorizes', async () => {
      mockGetCase.mockResolvedValue(undefined);
      req.can.mockImplementation(
        (user, action) => action === actionsMaps.contact.REMOVE_CONTACT_FROM_CASE,
      );
      await canDisconnectContact(req, {}, next);
      expect(req.can).toHaveBeenCalledWith(
        req.user,
        actionsMaps.contact.REMOVE_CONTACT_FROM_CASE,
        contact,
      );
      expectToBeAuthorized();
    });
    test('Can returns true for contact and case checks - authorizes', async () => {
      const mockCase = {} as CaseService;
      mockGetCase.mockResolvedValue(mockCase);
      req.can.mockReturnValue(true);
      await canDisconnectContact(req, {}, next);
      expect(req.can).toHaveBeenCalledWith(
        req.user,
        actionsMaps.contact.REMOVE_CONTACT_FROM_CASE,
        contact,
      );
      expect(req.can).toHaveBeenCalledWith(
        req.user,
        actionsMaps.case.UPDATE_CASE_CONTACTS,
        mockCase,
      );
      expectToBeAuthorized();
    });
    test('Can returns false - unauthorizes', async () => {
      const mockCase = {} as CaseService;
      mockGetCase.mockResolvedValue(mockCase);
      req.can.mockReturnValue(false);
      await canDisconnectContact(req, {}, next);
      expect(req.can).toHaveBeenCalledWith(
        req.user,
        actionsMaps.contact.REMOVE_CONTACT_FROM_CASE,
        contact,
      );
      expectToBeUnuthorized();
    });
    test('Can returns true for contact but false for case - unauthorizes', async () => {
      const mockCase = {} as CaseService;
      mockGetCase.mockResolvedValue(mockCase);
      req.can.mockImplementation(
        (user, action) => action === actionsMaps.contact.REMOVE_CONTACT_FROM_CASE,
      );
      await canDisconnectContact(req, {}, next);
      expect(req.can).toHaveBeenCalledWith(
        req.user,
        actionsMaps.contact.REMOVE_CONTACT_FROM_CASE,
        contact,
      );
      expect(req.can).toHaveBeenCalledWith(
        req.user,
        actionsMaps.case.UPDATE_CASE_CONTACTS,
        mockCase,
      );
      expectToBeUnuthorized();
    });
  });
  describe('draft contact', () => {
    describe(
      'can update case contacts',
      draftContactTests(true, async () => {
        req.can.mockImplementation(
          (user, action) => action === actionsMaps.case.UPDATE_CASE_CONTACTS,
        );
      }),
    );
    describe(
      'cannot update case contacts',
      draftContactTests(true, async () => {
        req.can.mockImplementation(
          (user, action) => action !== actionsMaps.case.UPDATE_CASE_CONTACTS,
        );
      }),
    );
  });
});

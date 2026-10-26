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

import { publishSns } from '@tech-matters/sns-client';
import { getEntityNotificationsTopicArn } from '@tech-matters/hrm-aselo-config';
import { CaseService, Contact } from '@tech-matters/hrm-types';
import {
  publishCaseChangeNotification,
  publishCaseDeleteNotification,
  publishContactChangeNotification,
} from '../../notifications/entityChangeNotify';

jest.mock('@tech-matters/sns-client', () => ({
  publishSns: jest.fn(),
}));
jest.mock('@tech-matters/hrm-aselo-config', () => ({
  ...(jest.requireActual('@tech-matters/hrm-aselo-config') as Record<string, unknown>),
  getEntityNotificationsTopicArn: jest.fn(),
}));

const mockPublishSns = publishSns as jest.MockedFunction<typeof publishSns>;
const mockGetEntityNotificationsTopicArn =
  getEntityNotificationsTopicArn as jest.MockedFunction<
    typeof getEntityNotificationsTopicArn
  >;

const accountSid = 'ACaccount';

const publishedMessageGroupIds = () =>
  mockPublishSns.mock.calls.map(([{ messageGroupId }]) => messageGroupId);

beforeEach(() => {
  mockGetEntityNotificationsTopicArn.mockResolvedValue('topic-arn');
  mockPublishSns.mockResolvedValue({ MessageId: 'message-id' } as any);
});

afterEach(() => {
  jest.resetAllMocks();
});

describe('message group IDs', () => {
  test('case notifications and notifications for contacts in the case share a message group', async () => {
    await publishCaseChangeNotification({
      accountSid,
      caseObj: { id: '42' } as CaseService,
      timeline: [],
      operation: 'update',
    });
    await publishCaseDeleteNotification({ accountSid, caseId: '42' });
    await publishContactChangeNotification({
      accountSid,
      contact: { id: '7', caseId: '42' } as Contact,
      operation: 'update',
    });
    await publishContactChangeNotification({
      accountSid,
      contact: { id: '7', caseId: '42' } as Contact,
      operation: 'delete',
    });

    expect(publishedMessageGroupIds()).toEqual(Array(4).fill(`${accountSid}-case-42`));
  });

  test('contacts not in a case use their own message group', async () => {
    await publishContactChangeNotification({
      accountSid,
      contact: { id: '7' } as Contact,
      operation: 'update',
    });

    expect(publishedMessageGroupIds()).toEqual([`${accountSid}-contact-7`]);
  });
});

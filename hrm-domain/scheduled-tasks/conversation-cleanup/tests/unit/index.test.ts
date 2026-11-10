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

jest.mock('@tech-matters/ssm-cache', () => ({
  // SsmParameterNotFound is checked with instanceof, so it must be a real Error subclass
  SsmParameterNotFound: class SsmParameterNotFound extends Error {},
  loadSsmCache: jest.fn(),
  loadParametersByName: jest.fn(),
  getCachedParameters: jest.fn(),
}));
jest.mock('@tech-matters/hrm-aselo-config', () => ({
  getTranscriptRetentionDays: jest.fn(),
  getTranscriptRetentionDaysSsmPath: jest.fn(
    ({ accountSid }) => `/test/hrm/${accountSid}/transcript_retention_days`,
  ),
  getTwilioAuthToken: jest.fn(),
}));
jest.mock('@tech-matters/twilio-client', () => ({
  getClient: jest.fn(),
}));

import { getCachedParameters, SsmParameterNotFound } from '@tech-matters/ssm-cache';
import {
  getTranscriptRetentionDays,
  getTwilioAuthToken,
} from '@tech-matters/hrm-aselo-config';
import { getClient } from '@tech-matters/twilio-client';
import { cleanupConversations } from '../../index';

const mockGetCachedParameters = getCachedParameters as jest.Mock;
const mockGetTranscriptRetentionDays = getTranscriptRetentionDays as jest.Mock;
const mockGetTwilioAuthToken = getTwilioAuthToken as jest.Mock;
const mockGetClient = getClient as jest.Mock;

const HOUR_MS = 60 * 60 * 1000;
const ACCOUNT_SID = 'AC00000000000000000000000000000001';

const conversationsResponse = (sids: string[]) => ({
  ok: true,
  json: async () => ({ conversations: sids.map(sid => ({ sid })) }),
});

const mockFetch = jest.fn();

// State and EndDate of each Conversations list request, in call order
const listRequests = () =>
  mockFetch.mock.calls.map(([url]) => {
    const { searchParams } = new URL(url);
    return { state: searchParams.get('State'), endDate: searchParams.get('EndDate') };
  });

// Jest 28's fake clock doesn't install on Node 24, so instead of freezing time, run the cleanup
// and check that each EndDate is the expected number of hours before a moment during the run
const runCleanup = async () => {
  const startedAt = Date.now();
  await cleanupConversations();
  const finishedAt = Date.now();
  return {
    expectHoursBeforeRun: (endDate: string | null, hours: number) => {
      const endDateMs = Date.parse(endDate ?? '');
      expect(endDateMs).toBeGreaterThanOrEqual(startedAt - hours * HOUR_MS);
      expect(endDateMs).toBeLessThanOrEqual(finishedAt - hours * HOUR_MS);
    },
  };
};

beforeEach(() => {
  // Let the 2 second delay between pages run straight away
  jest.spyOn(global, 'setTimeout').mockImplementation(((callback: () => void) => {
    callback();
    return 0;
  }) as unknown as typeof setTimeout);
  jest.spyOn(console, 'debug').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});

  global.fetch = mockFetch as unknown as typeof fetch;
  mockFetch.mockResolvedValue(conversationsResponse([]));
  mockGetCachedParameters.mockReturnValue({
    [`/test/twilio/${ACCOUNT_SID}/account_sid`]: ACCOUNT_SID,
  });
  mockGetTwilioAuthToken.mockResolvedValue('auth-token');
  mockGetTranscriptRetentionDays.mockResolvedValue('7');
});

afterEach(() => {
  jest.restoreAllMocks();
  mockFetch.mockReset();
});

describe('cleanupConversations', () => {
  test('looks for stuck active and inactive conversations older than 24 hours', async () => {
    const { expectHoursBeforeRun } = await runCleanup();

    const [active, inactive] = listRequests();
    expect(active.state).toBe('active');
    expectHoursBeforeRun(active.endDate, 24);
    expect(inactive.state).toBe('inactive');
    expectHoursBeforeRun(inactive.endDate, 24);
  });

  test('removes conversations in any state older than transcript_retention_days', async () => {
    const { expectHoursBeforeRun } = await runCleanup();

    const retention = listRequests()[2];
    expect(retention.state).toBeNull();
    expectHoursBeforeRun(retention.endDate, 7 * 24);
  });

  test('uses a 3650 day retention when transcript_retention_days is not set', async () => {
    mockGetTranscriptRetentionDays.mockRejectedValue(new SsmParameterNotFound('not set'));

    const { expectHoursBeforeRun } = await runCleanup();

    expectHoursBeforeRun(listRequests()[2].endDate, 3650 * 24);
  });

  test('closes stuck active conversations it finds', async () => {
    const update = jest.fn().mockResolvedValue({ state: 'closed' });
    const remove = jest.fn();
    mockGetClient.mockResolvedValue({
      conversations: {
        v1: { conversations: { get: jest.fn(() => ({ update, remove })) } },
      },
    });
    mockFetch.mockResolvedValueOnce(
      conversationsResponse(['CH00000000000000000000000000000001']),
    );

    await cleanupConversations();

    expect(update).toHaveBeenCalledWith({ state: 'closed' });
    expect(remove).not.toHaveBeenCalled();
  });
});

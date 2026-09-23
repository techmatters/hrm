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

import { getSsmParameter } from '@tech-matters/ssm-cache';
import { readApiInChunks } from '../../src/apiChunkReader';
import { createBeaconDocumentProcessor } from '../../src/beaconDocumentProcessors';
import { handler } from '../../src/index';

jest.mock('../../src/apiChunkReader', () => ({ readApiInChunks: jest.fn() }));
jest.mock('@tech-matters/ssm-cache', () => ({ getSsmParameter: jest.fn() }));
jest.mock('../../src/beaconDocumentProcessors', () => ({
  createBeaconDocumentProcessor: jest.fn(),
}));

const mockedGetSsmParameter = getSsmParameter as jest.MockedFunction<typeof getSsmParameter>;
const mockedReadApiInChunks = readApiInChunks as jest.MockedFunction<typeof readApiInChunks>;
const mockedCreateBeaconDocumentProcessor = createBeaconDocumentProcessor as jest.MockedFunction<
  typeof createBeaconDocumentProcessor
>;

const setupSsm = (apiVersion: 'v1' | 'v2' | null) => {
  mockedGetSsmParameter.mockImplementation(async (path: string) => {
    const values: Record<string, string> = {
      '/test/twilio/AS/account_sid': 'AC123',
      '/test/hrm/custom-integration/as/beacon_base_url': 'https://beacon.example',
      '/test/hrm/custom-integration/as/beacon_api_key': 'abc123',
    };
    if (path === '/test/hrm/custom-integration/as/beacon_update_api_version') {
      if (apiVersion === null) throw new Error('ParameterNotFound');
      return apiVersion;
    }
    if (values[path]) return values[path];
    throw new Error(`Unexpected SSM path: ${path}`);
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NODE_ENV = 'test';
  process.env.MAX_INCIDENT_REPORTS_PER_CALL = '10';
  process.env.MAX_CASE_REPORTS_PER_CALL = '10';
  process.env.MAX_CONSECUTIVE_API_CALLS = '2';
  mockedCreateBeaconDocumentProcessor.mockReturnValue((async () => 'ok') as any);
  mockedReadApiInChunks.mockResolvedValue(undefined as any);
});

describe('handler', () => {
  test('uses v1 beacon endpoint when update API version is v1', async () => {
    setupSsm('v1');
    await handler({ apiType: 'incidentReport', helplineShortCode: 'as' });

    const pollConfig = mockedReadApiInChunks.mock.calls[0][0] as any;
    expect(pollConfig.url.toString()).toBe('https://beacon.example/api/aselo/incidents/updates');
  });

  test('uses versioned beacon endpoint when update API version is v2', async () => {
    setupSsm('v2');
    await handler({ apiType: 'caseReport', helplineShortCode: 'as' });

    const pollConfig = mockedReadApiInChunks.mock.calls[0][0] as any;
    expect(pollConfig.url.toString()).toBe(
      'https://beacon.example/api/aselo/v2/case_reports/updates',
    );
  });

  test('falls back to v1 endpoint when update API version SSM parameter is missing', async () => {
    setupSsm(null);
    await handler({ apiType: 'caseReport', helplineShortCode: 'as' });

    const pollConfig = mockedReadApiInChunks.mock.calls[0][0] as any;
    expect(pollConfig.url.toString()).toBe('https://beacon.example/api/aselo/case_reports/updates');
  });
});

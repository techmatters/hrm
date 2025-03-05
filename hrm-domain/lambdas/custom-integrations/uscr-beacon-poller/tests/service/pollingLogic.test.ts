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
import { MockedEndpoint, Mockttp } from 'mockttp';
import { addHours } from 'date-fns/addHours';
import { subDays } from 'date-fns/subDays';
import { mockingProxy, mockSsmParameters } from '@tech-matters/testing';
import { putSsmParameter } from '@tech-matters/ssm-cache';
import { clearAllTables } from '@tech-matters/hrm-service-test-support';

import { db } from './dbConnection';
import { handler, IncidentReport } from '../../src';

const ACCOUNT_SID = 'ACservicetest';
const BEACON_RESPONSE_HEADERS = {
  'Content-Type': 'application/json',
};
const HRM_REQUEST_HEADERS = {
  'Content-Type': 'application/json',
  Authorization: `Basic ${process.env.STATIC_KEY}`,
};
const MAX_INCIDENT_REPORTS_PER_CALL = 5;
process.env.MAX_INCIDENT_REPORTS_PER_CALL = MAX_INCIDENT_REPORTS_PER_CALL.toString();
process.env.MAX_CONSECUTIVE_API_CALLS = '5';
const BASELINE_DATE = new Date('2001-01-01T00:00:00.000Z');
const LAST_SEEN_PARAMETER_NAME = `/${process.env.NODE_ENV}/hrm/custom-integration/uscr/${ACCOUNT_SID}/latest_beacon_update_seen`;

export const mockLastUpdateSeenParameter = async (mockttp: Mockttp) => {
  await mockSsmParameters(mockttp, [
    {
      name: LAST_SEEN_PARAMETER_NAME,
      valueGenerator: () => '',
      updateable: true,
    },
  ]);
};

const generateCases = (numberToGenerate: number): Promise<number[]> => {
  return Promise.all(
    Array(numberToGenerate)
      .fill(0)
      .map(async () => {
        const dbCase = await db.one(`INSERT INTO public."Cases" (  "accountSid",
            "info",
            "helpline",
            "status",
            "twilioWorkerId",
            "createdBy",
            "createdAt",
           "updatedBy",
           "updatedAt") VALUES 
            ('${ACCOUNT_SID}', '{}'::JSONB, '', 'open', 'WKfake', 'WKfake', '${new Date().toISOString()}', 'WKfake', '${new Date().toISOString()}') RETURNING *`);

        const newCaseResponse = await fetch(
          `${process.env.INTERNAL_HRM_URL}/internal/v0/accounts/${ACCOUNT_SID}/cases/${dbCase.id}/sections`,
          { method: 'POST', body: JSON.stringify({}), headers: HRM_REQUEST_HEADERS },
        );
        const newCase = await newCaseResponse.json();
        console.debug('Generated case:', newCase);
        return parseInt((newCase as any).id);
      }),
  );
};

let mockedBeaconEndpoint: MockedEndpoint;

const generateIncidentReports = (
  numberToGenerate: number,
  intervalInHours: number,
  caseIds: number[] = [],
  start: Date = BASELINE_DATE,
): IncidentReport[] => {
  const response = [];
  for (let i = 0; i < numberToGenerate; i++) {
    response.push({
      lastUpdated: addHours(start, i * intervalInHours).toISOString(),
      caseId: caseIds[i % caseIds.length].toString(),
    });
  }
  return response;
};

const batchIncidentReports = (
  reports: IncidentReport[],
  batchSize: number,
): IncidentReport[][] => {
  const batches = [];
  for (let i = 0; i < reports.length; i += batchSize) {
    batches.push(reports.slice(i, i + batchSize));
  }
  return batches;
};

let beaconMockPriority = 0;

export const mockBeacon = async (
  mockttp: Mockttp,
  responses: IncidentReport[][],
): Promise<MockedEndpoint> => {
  process.env.BEACON_URL = `http://localhost:${mockttp.port}/mock-beacon`;
  console.debug(
    `Mocking beacon endpoint: GET ${process.env.BEACON_URL} to respond with ${responses.length} responses:`,
  );
  responses.map((r, idx) => console.debug(idx, r));
  let currentResponseIndex = 0;
  return mockttp
    .forGet(process.env.BEACON_URL!)
    .always()
    .asPriority(beaconMockPriority++)
    .thenCallback(async () => ({
      statusCode: 200,
      body: JSON.stringify(responses[currentResponseIndex++]),
      headers: BEACON_RESPONSE_HEADERS,
    }));
};

afterAll(async () => {
  await mockingProxy.stop();
});

beforeAll(async () => {
  await mockingProxy.start();
  mockedBeaconEndpoint = await mockBeacon(await mockingProxy.mockttpServer(), []);
  await mockLastUpdateSeenParameter(await mockingProxy.mockttpServer());
  await new Promise(resolve => setTimeout(resolve, 60000));
});

beforeEach(async () => {
  await clearAllTables(db);
  await putSsmParameter(
    LAST_SEEN_PARAMETER_NAME,
    subDays(BASELINE_DATE, 1).toISOString(),
  );
});

describe('Beacon Polling Service - polling logic', () => {
  test("Returns less than the maximum records - doesn't query again", async () => {
    const caseIds = await generateCases(4);
    mockedBeaconEndpoint = await mockBeacon(await mockingProxy.mockttpServer(), [
      generateIncidentReports(4, 1, caseIds),
    ]);
    await handler();
    const beaconRequests = await mockedBeaconEndpoint.getSeenRequests();
    expect(beaconRequests.length).toBe(1);

    expect(beaconRequests[0].url).toBe(
      `${process.env.BEACON_URL}?updatedAfter=${subDays(
        BASELINE_DATE,
        1,
      ).toISOString()}&max=${MAX_INCIDENT_REPORTS_PER_CALL}`,
    );
  });
  test('Returns the maximum records - queries again', async () => {
    const caseIds = await generateCases(12);
    mockedBeaconEndpoint = await mockBeacon(
      await mockingProxy.mockttpServer(),
      batchIncidentReports(
        generateIncidentReports(12, 1, caseIds),
        MAX_INCIDENT_REPORTS_PER_CALL,
      ),
    );
    await handler();
    const beaconRequests = await mockedBeaconEndpoint.getSeenRequests();
    expect(beaconRequests.length).toBe(3);

    expect(beaconRequests[0].url).toBe(
      `${process.env.BEACON_URL}?updatedAfter=${subDays(
        BASELINE_DATE,
        1,
      ).toISOString()}&max=${MAX_INCIDENT_REPORTS_PER_CALL}`,
    );

    expect(beaconRequests[1].url).toBe(
      `${process.env.BEACON_URL}?updatedAfter=${addHours(
        BASELINE_DATE,
        4,
      ).toISOString()}&max=${MAX_INCIDENT_REPORTS_PER_CALL}`,
    );

    expect(beaconRequests[2].url).toBe(
      `${process.env.BEACON_URL}?updatedAfter=${addHours(
        BASELINE_DATE,
        9,
      ).toISOString()}&max=${MAX_INCIDENT_REPORTS_PER_CALL}`,
    );
  });
  test('Returns the maximum records for more than the maximum allowed number of queries in a polling sweep - stops querying', async () => {
    const caseIds = await generateCases(30);
    mockedBeaconEndpoint = await mockBeacon(
      await mockingProxy.mockttpServer(),
      batchIncidentReports(
        generateIncidentReports(1000, 1, caseIds),
        MAX_INCIDENT_REPORTS_PER_CALL,
      ),
    );
    await handler();
    const beaconRequests = await mockedBeaconEndpoint.getSeenRequests();
    expect(beaconRequests.length).toBe(5);
  });
});

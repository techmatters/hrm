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

import { handler } from '../../src';
import { MockedEndpoint, Mockttp } from 'mockttp';
import { mockingProxy, mockSsmParameters } from '@tech-matters/testing';
import { addHours } from 'date-fns/addHours';
import { subDays } from 'date-fns/subDays';
const ACCOUNT_SID = 'ACservicetest';
const BEACON_RESPONSE_HEADERS = {
  'Content-Type': 'application/json',
};
const MAX_INCIDENT_REPORTS_PER_CALL = 5;
process.env.MAX_INCIDENT_REPORTS_PER_CALL = MAX_INCIDENT_REPORTS_PER_CALL.toString();
const BASELINE_DATE = new Date('2001-01-01T00:00:00.000Z');

export const mockLastUpdateSeenParameter = async (
  mockttp: Mockttp,
  lastUpdateSeen: Date,
) => {
  const lastUpdateSeenIso = lastUpdateSeen.toISOString();
  await mockSsmParameters(mockttp, [
    {
      name: `/${process.env.NODE_ENV}/hrm/custom-integration/uscr/${ACCOUNT_SID}/latest_beacon_update_seen`,
      valueGenerator: () => lastUpdateSeenIso,
    },
  ]);
};

type IncidentReport = {
  lastUpdated: string;
};
let mockedBeaconEndpoint: MockedEndpoint;

const generateIncidentReports = (
  numberToGenerate: number,
  intervalInHours: number,
  start: Date = BASELINE_DATE,
): IncidentReport[] => {
  const response = [];
  for (let i = 0; i < numberToGenerate; i++) {
    response.push({
      lastUpdated: addHours(start, i * intervalInHours).toISOString(),
    });
  }
  return response;
};

let beaconMockPriority = 0;

export const mockBeacon = async (
  mockttp: Mockttp,
  response: IncidentReport[],
): Promise<MockedEndpoint> => {
  process.env.BEACON_URL = `http://localhost:${mockttp.port}/mock-beacon`;
  console.log(
    `Mocking beacon endpoint: GET ${process.env.BEACON_URL} to respond with:`,
    response,
  );
  return mockttp
    .forGet(process.env.BEACON_URL!)
    .always()
    .asPriority(beaconMockPriority++)
    .thenJson(200, response, BEACON_RESPONSE_HEADERS);
};

afterAll(async () => {
  await mockingProxy.stop();
});

beforeAll(async () => {
  await mockingProxy.start();
  mockedBeaconEndpoint = await mockBeacon(await mockingProxy.mockttpServer(), []);
});

beforeEach(async () => {
  await mockLastUpdateSeenParameter(
    await mockingProxy.mockttpServer(),
    subDays(BASELINE_DATE, 1),
  );
});

describe('Beacon Polling Service - polling logic', () => {
  test("Returns less than the maximum records - doesn't query again", async () => {
    mockedBeaconEndpoint = await mockBeacon(
      await mockingProxy.mockttpServer(),
      generateIncidentReports(4, 1),
    );
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
});

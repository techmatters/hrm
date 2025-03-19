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
import { CaseSectionRecord } from '@tech-matters/hrm-types';
import { putSsmParameter } from '@tech-matters/ssm-cache';
import { clearAllTables } from '@tech-matters/hrm-service-test-support';
import each from 'jest-each';

import { db } from './dbConnection';
import { BEACON_API_KEY_HEADER } from '../../src/config';
import { handler } from '../../src';
import { parseISO } from 'date-fns';
import { IncidentReport } from '../../src/incidentReport';
import {
  generateCaseReport,
  generateCompleteCaseReport,
  generateIncidentReport,
} from '../mockGenerators';
import { CaseReport } from '../../src/caseReport';

const ACCOUNT_SID = 'ACservicetest';
const BEACON_RESPONSE_HEADERS = {
  'Content-Type': 'application/json',
};
const HRM_REQUEST_HEADERS = {
  'Content-Type': 'application/json',
  Authorization: `Basic ${process.env.STATIC_KEY}`,
};
const MAX_ITEMS_PER_CALL = 5;
process.env.MAX_INCIDENT_REPORTS_PER_CALL = MAX_ITEMS_PER_CALL.toString();
process.env.MAX_CASE_REPORTS_PER_CALL = MAX_ITEMS_PER_CALL.toString();
process.env.MAX_CONSECUTIVE_API_CALLS = '5';
const BASELINE_DATE = new Date('2001-01-01T00:00:00.000Z');
const LAST_INCIDENT_REPORT_SEEN_PARAMETER_NAME = `/${process.env.NODE_ENV}/hrm/custom-integration/uscr/${ACCOUNT_SID}/beacon/latest_incident_report_seen`;
const LAST_CASE_REPORT_SEEN_PARAMETER_NAME = `/${process.env.NODE_ENV}/hrm/custom-integration/uscr/${ACCOUNT_SID}/beacon/latest_case_report_seen`;

export const mockLastUpdateSeenParameter = async (mockttp: Mockttp) => {
  await mockSsmParameters(mockttp, [
    {
      name: LAST_INCIDENT_REPORT_SEEN_PARAMETER_NAME,
      valueGenerator: () => '',
      updateable: true,
    },
    {
      name: LAST_CASE_REPORT_SEEN_PARAMETER_NAME,
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
        const newCaseResponse = await fetch(
          `${process.env.INTERNAL_HRM_URL}/internal/v0/accounts/${ACCOUNT_SID}/cases`,
          { method: 'POST', body: JSON.stringify({}), headers: HRM_REQUEST_HEADERS },
        );
        const newCase: any = await newCaseResponse.json();
        console.debug('Generated case:', newCase.id);
        return parseInt(newCase.id);
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
  const response: IncidentReport[] = [];
  for (let i = 0; i < numberToGenerate; i++) {
    const indexInCurrentIteration = i % caseIds.length;
    const iteration = Math.floor(i / caseIds.length);
    response.push(
      generateIncidentReport({
        updated_at: addHours(start, (i + 1) * intervalInHours).toISOString(),
        ...(caseIds[indexInCurrentIteration]
          ? { case_id: caseIds[indexInCurrentIteration] }
          : {}),
        id: iteration,
        contact_id: `contact-for-case-${caseIds[indexInCurrentIteration]}`,
        description: `Incident report #${iteration}, for case ${caseIds[indexInCurrentIteration]}`,
        address: `Address for incident report #${iteration}`,
        category_id: 1,
        incident_class_id: 1,
        status: 'open',
        caller_name: 'Caller Name',
        responder_name: `Responder Name on report #${iteration}, case #${caseIds[indexInCurrentIteration]}`,
        caller_number: '1234567890',
        created_at: start.toISOString(),
      }),
    );
  }
  return response;
};

const generateCaseReports = (
  numberToGenerate: number,
  intervalInHours: number,
  caseIds: number[] = [],
  start: Date = BASELINE_DATE,
  completeReport: boolean = false,
): CaseReport[] => {
  const response: CaseReport[] = [];
  for (let i = 0; i < numberToGenerate; i++) {
    const indexInCurrentIteration = i % caseIds.length;
    const iteration = Math.floor(i / caseIds.length);
    response.push(
      (completeReport ? generateCompleteCaseReport : generateCaseReport)({
        updated_at: addHours(start, (i + 1) * intervalInHours).toISOString(),
        ...(caseIds[indexInCurrentIteration]
          ? { case_id: caseIds[indexInCurrentIteration] }
          : {}),
        id: iteration.toString(),
        contact_id: `contact-for-case-${caseIds[indexInCurrentIteration]}`,
      }),
    );
  }
  return response;
};

const batch = <TItem>(reports: TItem[], batchSize: number): TItem[][] => {
  const batches = [];
  for (let i = 0; i < reports.length; i += batchSize) {
    batches.push(reports.slice(i, i + batchSize));
  }
  return batches;
};

let beaconMockPriority = 0;

export const mockBeacon = async <TItem>(
  mockttp: Mockttp,
  apiPath: string,
  responses: TItem[][],
): Promise<MockedEndpoint> => {
  process.env.BEACON_BASE_URL = `http://127.0.0.1:${mockttp.port}/mock-beacon`;
  console.debug(
    `Mocking beacon endpoint: GET ${process.env.BEACON_BASE_URL}${apiPath} to respond with ${responses.length} responses`,
  );
  let currentResponseIndex = 0;
  return mockttp
    .forGet(`${process.env.BEACON_BASE_URL}${apiPath}`)
    .always()
    .asPriority(beaconMockPriority++)
    .thenCallback(async () => {
      const response = responses[currentResponseIndex] ?? [];
      console.debug(`Response ${currentResponseIndex++}, ${response.length} items`);
      return {
        statusCode: 200,
        body: JSON.stringify(response),
        headers: BEACON_RESPONSE_HEADERS,
      };
    });
};

const verifyCaseSectionsForCase =
  <TItem>(
    caseSectionType: string,
    sectionVerifier: (actual: CaseSectionRecord, expected: TItem) => void,
    expectedItemsSortComparer: (ir1: TItem, ir2: TItem) => number,
  ) =>
  async (caseId: number, expectedItems: TItem[]): Promise<void> => {
    expectedItems.sort(expectedItemsSortComparer);

    const records: CaseSectionRecord[] = await db.manyOrNone(
      `SELECT "sectionId", "sectionTypeSpecificData" FROM public."CaseSections" WHERE "accountSid" = $<accountSid> AND "caseId" = $<caseId> AND "sectionType" = $<caseSectionType> ORDER BY "sectionId" ASC`,
      {
        caseId,
        accountSid: ACCOUNT_SID,
        caseSectionType,
      },
    );
    expect(records.length).toBe(expectedItems.length);
    // Extremely basic check to ensure the records are in the correct order, detailed mapping verification is in incidentReport unit tests
    records.forEach((r, idx) => {
      sectionVerifier(r, expectedItems[idx]);
    });
  };
afterAll(async () => {
  await mockingProxy.stop();
});

beforeAll(async () => {
  await mockingProxy.start();
  mockedBeaconEndpoint = await mockBeacon(
    await mockingProxy.mockttpServer(),
    'incidentReport',
    [],
  );
  await mockLastUpdateSeenParameter(await mockingProxy.mockttpServer());
});

beforeEach(async () => {
  await clearAllTables(db);
  await putSsmParameter(
    LAST_INCIDENT_REPORT_SEEN_PARAMETER_NAME,
    subDays(BASELINE_DATE, 1).toISOString(),
  );
  await putSsmParameter(
    LAST_CASE_REPORT_SEEN_PARAMETER_NAME,
    subDays(BASELINE_DATE, 1).toISOString(),
  );
});

describe('Beacon Polling Service', () => {
  each([{ api: 'incidentReport' }, { api: 'caseReport' }]).describe(
    'Polling logic',
    ({ api }: { api: 'incidentReport' | 'caseReport' }) => {
      const apiPath =
        api === 'incidentReport'
          ? '/api/aselo/incidents/updates'
          : '/api/aselo/casereports/updates';
      test(`[${api}] Returns less than the maximum records - doesn't query again`, async () => {
        const caseIds = await generateCases(4);
        if (api === 'incidentReport') {
          mockedBeaconEndpoint = await mockBeacon(
            await mockingProxy.mockttpServer(),
            apiPath,
            [generateIncidentReports(4, 1, caseIds)],
          );
        } else {
          mockedBeaconEndpoint = await mockBeacon(
            await mockingProxy.mockttpServer(),
            apiPath,
            [generateCaseReports(4, 1, caseIds)],
          );
        }
        await handler({ api });
        const beaconRequests = await mockedBeaconEndpoint.getSeenRequests();
        expect(beaconRequests.length).toBe(1);

        expect(beaconRequests[0].url).toBe(
          `${process.env.BEACON_BASE_URL}${apiPath}?updated_after=${encodeURIComponent(
            subDays(BASELINE_DATE, 1).toISOString(),
          )}&max=${MAX_ITEMS_PER_CALL}`,
        );
        expect(beaconRequests[0].headers[BEACON_API_KEY_HEADER.toLowerCase()]).toBe(
          process.env.BEACON_API_KEY,
        );
      });
      test(`[${api}] Returns the maximum records - queries again`, async () => {
        const caseIds = await generateCases(12);
        if (api === 'incidentReport') {
          mockedBeaconEndpoint = await mockBeacon(
            await mockingProxy.mockttpServer(),
            apiPath,
            batch(generateIncidentReports(12, 1, caseIds), MAX_ITEMS_PER_CALL),
          );
        } else {
          mockedBeaconEndpoint = await mockBeacon(
            await mockingProxy.mockttpServer(),
            apiPath,
            batch(generateCaseReports(12, 1, caseIds), MAX_ITEMS_PER_CALL),
          );
        }
        await handler({ api });
        const beaconRequests = await mockedBeaconEndpoint.getSeenRequests();
        expect(beaconRequests.length).toBe(3);

        expect(decodeURI(beaconRequests[0].url)).toBe(
          `${process.env.BEACON_BASE_URL}${apiPath}?updated_after=${encodeURIComponent(
            subDays(BASELINE_DATE, 1).toISOString(),
          )}&max=${MAX_ITEMS_PER_CALL}`,
        );

        expect(decodeURI(beaconRequests[1].url)).toBe(
          `${process.env.BEACON_BASE_URL}${apiPath}?updated_after=${encodeURIComponent(
            addHours(BASELINE_DATE, 5).toISOString(),
          )}&max=${MAX_ITEMS_PER_CALL}`,
        );

        expect(decodeURI(beaconRequests[2].url)).toBe(
          `${process.env.BEACON_BASE_URL}${apiPath}?updated_after=${encodeURIComponent(
            addHours(BASELINE_DATE, 10).toISOString(),
          )}&max=${MAX_ITEMS_PER_CALL}`,
        );
      });
      test(`[${api}] Returns the maximum records for more than the maximum allowed number of queries in a polling sweep - stops querying`, async () => {
        const caseIds = await generateCases(30);
        if (api === 'incidentReport') {
          mockedBeaconEndpoint = await mockBeacon(
            await mockingProxy.mockttpServer(),
            apiPath,
            batch(generateIncidentReports(1000, 1, caseIds), MAX_ITEMS_PER_CALL),
          );
        } else {
          mockedBeaconEndpoint = await mockBeacon(
            await mockingProxy.mockttpServer(),
            apiPath,
            batch(generateCaseReports(1000, 1, caseIds), MAX_ITEMS_PER_CALL),
          );
        }
        await handler({ api });
        const beaconRequests = await mockedBeaconEndpoint.getSeenRequests();
        expect(beaconRequests.length).toBe(5);
      });
    },
  );

  describe('HRM case updates', () => {
    describe('Incident Reports', () => {
      const verifyIncidentReportsForCase = verifyCaseSectionsForCase(
        'incidentReport',
        (actual, expected: IncidentReport) => {
          const { id: incidentReportId, responder_name: responderName } = expected;
          expect(actual.sectionId).toBe(incidentReportId.toString());
          expect(actual.sectionTypeSpecificData).toMatchObject({ responderName });
        },
        (ir1, ir2) => ir1.id - ir2.id,
      );

      test('Single new incident reports for existing cases - adds all incidents', async () => {
        // Arrange
        const caseIds = await generateCases(2);
        const incidentReports = generateIncidentReports(2, 1, caseIds);
        mockedBeaconEndpoint = await mockBeacon(
          await mockingProxy.mockttpServer(),
          '/api/aselo/incidents/updates',
          [incidentReports],
        );
        // Act
        await handler({ api: 'incidentReport' });
        // Assert
        await verifyIncidentReportsForCase(caseIds[0], [incidentReports[0]]);
        await verifyIncidentReportsForCase(caseIds[1], [incidentReports[1]]);
      });
      test('Multiple new incident reports per case for existing cases - adds all incidents', async () => {
        // Arrange
        const caseIds = await generateCases(2);
        const incidentReports = generateIncidentReports(5, 1, caseIds);
        mockedBeaconEndpoint = await mockBeacon(
          await mockingProxy.mockttpServer(),
          '/api/aselo/incidents/updates',
          [incidentReports],
        );
        // Act
        await handler({ api: 'incidentReport' });
        // Assert
        await verifyIncidentReportsForCase(caseIds[0], [
          incidentReports[0],
          incidentReports[2],
          incidentReports[4],
        ]);
        await verifyIncidentReportsForCase(caseIds[1], [
          incidentReports[1],
          incidentReports[3],
        ]);
      });
      test('Single new incident reports, some without cases - rejects incidents without cases and adds the rest', async () => {
        // Arrange
        const caseIds = await generateCases(2);
        const incidentReports = generateIncidentReports(3, 1, [
          caseIds[0],
          undefined as any,
          caseIds[1],
        ]);
        mockedBeaconEndpoint = await mockBeacon(
          await mockingProxy.mockttpServer(),
          '/api/aselo/incidents/updates',
          [incidentReports],
        );
        // Act
        await handler({ api: 'incidentReport' });
        // Assert
        await verifyIncidentReportsForCase(caseIds[0], [incidentReports[0]]);
        await verifyIncidentReportsForCase(caseIds[1], [incidentReports[2]]);
      });
      test('Same incident multiple times in one batch - rejects all but first', async () => {
        // Arrange
        const caseIds = await generateCases(2);
        const incidentReports = generateIncidentReports(3, 2, caseIds);
        const updatedIncidentReport: IncidentReport = {
          ...generateIncidentReports(1, 5, caseIds)[0],
          description: 'Updated incident',
        };
        mockedBeaconEndpoint = await mockBeacon(
          await mockingProxy.mockttpServer(),
          '/api/aselo/incidents/updates',
          [
            [...incidentReports, updatedIncidentReport].sort(
              (ir1, ir2) =>
                parseISO(ir1.updated_at).getTime() - parseISO(ir2.updated_at).getTime(),
            ),
          ],
        );
        // Act
        await handler({ api: 'incidentReport' });
        // Assert
        await verifyIncidentReportsForCase(caseIds[0], [
          incidentReports[0],
          incidentReports[2],
        ]);
        await verifyIncidentReportsForCase(caseIds[1], [incidentReports[1]]);
      });
    });
    describe('Case Reports', () => {
      const verifyCaseReportsForCase = verifyCaseSectionsForCase(
        'caseReport',
        (actual, expected: CaseReport) => {
          expect(actual.sectionId).toEqual(expected.id);
          expect(actual.sectionTypeSpecificData.primaryDisposition).toEqual(
            expected.primary_disposition,
          );
        },
        (ir1, ir2) => ir1.id.localeCompare(ir2.id),
      );
      const verifyPehForCase = verifyCaseSectionsForCase(
        'caseReport',
        (actual, expected: CaseReport) => {
          expect(actual.sectionId).toEqual(expected.id);
          expect(actual.sectionTypeSpecificData.firstName).toEqual(
            expected.demographics?.first_name,
          );
        },
        (ir1, ir2) => ir1.id.localeCompare(ir2.id),
      );
      const verifySafetyPlanForCase = verifyCaseSectionsForCase(
        'caseReport',
        (actual, expected: CaseReport) => {
          expect(actual.sectionId).toEqual(expected.id);
          expect(actual.sectionTypeSpecificData.distractions).toEqual(
            expected.safety_plan?.distractions,
          );
        },
        (ir1, ir2) => ir1.id.localeCompare(ir2.id),
      );
      const verifySudSurveyForCase = verifyCaseSectionsForCase(
        'caseReport',
        (actual, expected: CaseReport) => {
          expect(actual.sectionId).toEqual(expected.id);
          expect(actual.sectionTypeSpecificData.substancesUsed).toEqual(
            expected.collaborative_sud_survey?.substances_used,
          );
        },
        (ir1, ir2) => ir1.id.localeCompare(ir2.id),
      );

      test('Complete case report - adds 4 sections to a case', async () => {
        // Arrange
        const caseIds = await generateCases(2);
        const caseReports = generateCaseReports(2, 1, caseIds);
        mockedBeaconEndpoint = await mockBeacon(
          await mockingProxy.mockttpServer(),
          '/api/aselo/casereports/updates',
          [caseReports],
        );
        // Act
        await handler({ api: 'caseReport' });
        // Assert
        await verifyCaseReportsForCase(caseIds[0], [caseReports[0]]);
        await verifyCaseReportsForCase(caseIds[1], [caseReports[1]]);
        await verifyPehForCase(caseIds[0], [caseReports[0]]);
        await verifyPehForCase(caseIds[1], [caseReports[1]]);
        await verifySafetyPlanForCase(caseIds[0], [caseReports[0]]);
        await verifySafetyPlanForCase(caseIds[1], [caseReports[1]]);
        await verifySudSurveyForCase(caseIds[0], [caseReports[0]]);
        await verifySudSurveyForCase(caseIds[1], [caseReports[1]]);
      });
    });
  });
});

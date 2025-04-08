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
import { Responder } from '../../src/responder';
import {
  RawCaseReportApiPayload,
  restructureApiContent,
} from '../../src/caseReport/apiPayload';

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

type CaseOverviewPatch = { priority: string; operatingArea: string };

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

const generateCases = (numberToGenerate: number): Promise<string[]> => {
  return Promise.all(
    Array(numberToGenerate)
      .fill(0)
      .map(async () => {
        const newCaseResponse = await fetch(
          `${process.env.INTERNAL_HRM_URL}/internal/v0/accounts/${ACCOUNT_SID}/cases`,
          {
            method: 'POST',
            body: JSON.stringify({
              info: { summary: 'something' },
            }),
            headers: HRM_REQUEST_HEADERS,
          },
        );
        if (!newCaseResponse.ok) {
          throw new Error(
            `Create case HTTP call failed: [${
              newCaseResponse.status
            }] ${await newCaseResponse.text()}`,
          );
        }
        const newCase: any = await newCaseResponse.json();
        console.debug('Generated case:', newCase.id);
        return newCase.id;
      }),
  );
};

let mockedBeaconEndpoint: MockedEndpoint;

const generateIncidentReports = (
  numberToGenerate: number,
  intervalInHours: number,
  caseIds: string[] = [],
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
        class: 'Pasadena',
        priority: 'Low',
        status: 'open',
        caller_name: 'Caller Name',
        responders: [40404, 40405].map(id => ({
          id,
          name: `Responder for case #${caseIds[indexInCurrentIteration]} on incident #${iteration} with id #${id}`,
          timestamps: {} as any,
        })),
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
  caseIds: string[] = [],
  start: Date = BASELINE_DATE,
  completeReport: boolean = false,
): RawCaseReportApiPayload[] => {
  const response: RawCaseReportApiPayload[] = [];
  for (let i = 0; i < numberToGenerate; i++) {
    const indexInCurrentIteration = i % caseIds.length;
    const iteration = Math.floor(i / caseIds.length);
    response.push(
      (completeReport ? generateCompleteCaseReport : generateCaseReport)({
        updated_at: addHours(start, (i + 1) * intervalInHours).toISOString(),
        ...(caseIds[indexInCurrentIteration]
          ? { case_id: caseIds[indexInCurrentIteration] }
          : {}),
        id: iteration,
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
        body: JSON.stringify({
          status: 'success',
          [apiPath.includes('incidents') ? 'incidents' : 'case_reports']: response,
        }),
        headers: BEACON_RESPONSE_HEADERS,
      };
    });
};

const verifyCaseOverviewForCase = async (
  caseId: string,
  expectedOverview: CaseOverviewPatch,
): Promise<void> => {
  const record: { info: CaseOverviewPatch } = await db.one(
    `SELECT "info" FROM public."Cases" WHERE "accountSid" = $<accountSid> AND "id" = $<caseId>`,
    {
      caseId,
      accountSid: ACCOUNT_SID,
    },
  );
  expect(record.info).toStrictEqual({ ...expectedOverview, summary: 'something' });
};

const verifyCaseStatusForCase = async (
  caseId: string,
  expectedStatus: string,
): Promise<void> => {
  const record: { status: string } = await db.one(
    `SELECT "status" FROM public."Cases" WHERE "accountSid" = $<accountSid> AND "id" = $<caseId>`,
    {
      caseId,
      accountSid: ACCOUNT_SID,
    },
  );
  expect(record.status).toStrictEqual(expectedStatus);
};

const verifyCaseSectionsForCase =
  <TItem>(
    caseSectionType: string,
    sectionVerifier: (actual: CaseSectionRecord, expected: TItem) => void,
    expectedItemsSortComparer: (ir1: TItem, ir2: TItem) => number,
  ) =>
  async (caseId: string, expectedItems: TItem[]): Promise<void> => {
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
    { overwrite: true },
  );
  await putSsmParameter(
    LAST_CASE_REPORT_SEEN_PARAMETER_NAME,
    subDays(BASELINE_DATE, 1).toISOString(),
    { overwrite: true },
  );
});

describe('Beacon Polling Service', () => {
  each([{ apiType: 'incidentReport' }, { apiType: 'caseReport' }]).describe(
    'Polling logic',
    ({ apiType }: { apiType: 'incidentReport' | 'caseReport' }) => {
      const apiPath =
        apiType === 'incidentReport'
          ? '/api/aselo/incidents/updates'
          : '/api/aselo/case_reports/updates';
      test(`[${apiType}] Returns less than the maximum records - doesn't query again`, async () => {
        const caseIds = await generateCases(4);
        if (apiType === 'incidentReport') {
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
        await handler({ apiType });
        const beaconRequests = await mockedBeaconEndpoint.getSeenRequests();
        expect(beaconRequests.length).toBe(1);

        expect(beaconRequests[0].url).toBe(
          `${process.env.BEACON_BASE_URL}${apiPath}?updated_after=${encodeURIComponent(
            subDays(BASELINE_DATE, 1).toISOString(),
          )}&limit=${MAX_ITEMS_PER_CALL}`,
        );
        expect(beaconRequests[0].headers[BEACON_API_KEY_HEADER.toLowerCase()]).toBe(
          process.env.BEACON_API_KEY,
        );
      });
      test(`[${apiType}] Returns the maximum records - queries again`, async () => {
        const caseIds = await generateCases(12);
        if (apiType === 'incidentReport') {
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
        await handler({ apiType });
        const beaconRequests = await mockedBeaconEndpoint.getSeenRequests();
        expect(beaconRequests.length).toBe(3);

        expect(decodeURI(beaconRequests[0].url)).toBe(
          `${process.env.BEACON_BASE_URL}${apiPath}?updated_after=${encodeURIComponent(
            subDays(BASELINE_DATE, 1).toISOString(),
          )}&limit=${MAX_ITEMS_PER_CALL}`,
        );

        expect(decodeURI(beaconRequests[1].url)).toBe(
          `${process.env.BEACON_BASE_URL}${apiPath}?updated_after=${encodeURIComponent(
            addHours(BASELINE_DATE, 5).toISOString(),
          )}&limit=${MAX_ITEMS_PER_CALL}`,
        );

        expect(decodeURI(beaconRequests[2].url)).toBe(
          `${process.env.BEACON_BASE_URL}${apiPath}?updated_after=${encodeURIComponent(
            addHours(BASELINE_DATE, 10).toISOString(),
          )}&limit=${MAX_ITEMS_PER_CALL}`,
        );
      });
      test(`[${apiType}] Returns the maximum records for more than the maximum allowed number of queries in a polling sweep - stops querying`, async () => {
        const caseIds = await generateCases(30);
        if (apiType === 'incidentReport') {
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
        await handler({ apiType });
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
          const { id: incidentReportId } = expected;
          expect(actual.sectionId).toBe(incidentReportId.toString());
        },
        (ir1, ir2) => ir1.id - ir2.id,
      );

      const respondersWithIncidentId = (incidentReport: IncidentReport) =>
        incidentReport.responders.map(responder => ({
          responder,
          incidentReportId: incidentReport.id,
        }));

      const verifyRespondersForCase = verifyCaseSectionsForCase(
        'assignedResponder',
        (
          actual,
          {
            responder,
            incidentReportId,
          }: { responder: Responder; incidentReportId: number },
        ) => {
          const { name, id } = responder;
          expect(actual.sectionId).toBe(`${incidentReportId}/${id}`);
          expect(actual.sectionTypeSpecificData).toMatchObject({
            responderName: name,
          });
        },
        ({ responder: r1 }, { responder: r2 }) => r1.name.localeCompare(r2.name),
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
        await handler({ apiType: 'incidentReport' });
        // Assert
        await verifyCaseOverviewForCase(caseIds[0], {
          priority: 'Low',
          operatingArea: 'Pasadena',
        });
        await verifyIncidentReportsForCase(caseIds[0], [incidentReports[0]]);
        await verifyRespondersForCase(
          caseIds[0],
          respondersWithIncidentId(incidentReports[0]),
        );
        await verifyIncidentReportsForCase(caseIds[1], [incidentReports[1]]);
        await verifyRespondersForCase(
          caseIds[1],
          respondersWithIncidentId(incidentReports[1]),
        );
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
        await handler({ apiType: 'incidentReport' });
        // Assert
        await verifyCaseOverviewForCase(caseIds[0], {
          priority: 'Low',
          operatingArea: 'Pasadena',
        });
        await verifyIncidentReportsForCase(caseIds[0], [
          incidentReports[0],
          incidentReports[2],
          incidentReports[4],
        ]);

        await verifyRespondersForCase(caseIds[0], [
          ...respondersWithIncidentId(incidentReports[0]),
          ...respondersWithIncidentId(incidentReports[2]),
          ...respondersWithIncidentId(incidentReports[4]),
        ]);

        await verifyIncidentReportsForCase(caseIds[1], [
          incidentReports[1],
          incidentReports[3],
        ]);

        await verifyRespondersForCase(caseIds[1], [
          ...respondersWithIncidentId(incidentReports[1]),
          ...respondersWithIncidentId(incidentReports[3]),
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
        await handler({ apiType: 'incidentReport' });
        // Assert
        await verifyCaseOverviewForCase(caseIds[0], {
          priority: 'Low',
          operatingArea: 'Pasadena',
        });
        await verifyIncidentReportsForCase(caseIds[0], [incidentReports[0]]);
        await verifyRespondersForCase(
          caseIds[0],
          respondersWithIncidentId(incidentReports[0]),
        );
        await verifyIncidentReportsForCase(caseIds[1], [incidentReports[2]]);
        await verifyRespondersForCase(
          caseIds[1],
          respondersWithIncidentId(incidentReports[2]),
        );
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
        await handler({ apiType: 'incidentReport' });
        // Assert
        await verifyCaseOverviewForCase(caseIds[0], {
          priority: 'Low',
          operatingArea: 'Pasadena',
        });
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
        (actual, expected: RawCaseReportApiPayload) => {
          const processedExpected = restructureApiContent(expected);
          expect(actual.sectionId).toEqual(processedExpected.id.toString());
          expect(actual.sectionTypeSpecificData.primaryDisposition).toEqual(
            processedExpected['Primary Disposition']?.['Select One'],
          );
        },
        (ir1, ir2) => ir1.id - ir2.id,
      );
      const verifyPehForCase = verifyCaseSectionsForCase(
        'personExperiencingHomelessness',
        (actual, expected: RawCaseReportApiPayload) => {
          const processedExpected = restructureApiContent(expected);
          expect(actual.sectionId).toEqual(processedExpected.id.toString());
          expect(actual.sectionTypeSpecificData.firstName).toEqual(
            processedExpected.Demographics?.['First Name'],
          );
        },
        (ir1, ir2) => ir1.id - ir2.id,
      );
      const verifySafetyPlanForCase = verifyCaseSectionsForCase(
        'safetyPlan',
        (actual, expected: RawCaseReportApiPayload) => {
          const processedExpected = restructureApiContent(expected);
          expect(actual.sectionId).toEqual(processedExpected.id.toString());
          expect(actual.sectionTypeSpecificData.distractions).toEqual(
            processedExpected['Safety Plan']?.['Write People or Places Here'],
          );
        },
        (ir1, ir2) => ir1.id - ir2.id,
      );
      const verifySudSurveyForCase = verifyCaseSectionsForCase(
        'sudSurvey',
        (actual, expected: RawCaseReportApiPayload) => {
          const processedExpected = restructureApiContent(expected);
          const selections =
            processedExpected?.['Collaborative SUD Survey']?.[
              'In the past 3 months, have you used any of the following substances (check all that apply)'
            ] ?? {};

          expect(actual.sectionTypeSpecificData.substancesUsed).toEqual(
            Object.entries(selections)
              .filter(([, checked]) => typeof checked === 'boolean' && checked)
              .map(([substance]) => substance),
          );
        },
        (ir1, ir2) => ir1.id - ir2.id,
      );

      test('Complete case report - adds 4 sections to a case', async () => {
        // Arrange
        const caseIds = await generateCases(2);
        const caseReports = generateCaseReports(2, 1, caseIds, BASELINE_DATE, true);
        mockedBeaconEndpoint = await mockBeacon(
          await mockingProxy.mockttpServer(),
          '/api/aselo/case_reports/updates',
          [caseReports],
        );
        // Act
        await handler({ apiType: 'caseReport' });
        // Assert
        await verifyCaseReportsForCase(caseIds[0], [caseReports[0]]);
        await verifyCaseReportsForCase(caseIds[1], [caseReports[1]]);
        await verifyPehForCase(caseIds[0], [caseReports[0]]);
        await verifyPehForCase(caseIds[1], [caseReports[1]]);
        await verifySafetyPlanForCase(caseIds[0], [caseReports[0]]);
        await verifySafetyPlanForCase(caseIds[1], [caseReports[1]]);
        await verifySudSurveyForCase(caseIds[0], [caseReports[0]]);
        await verifySudSurveyForCase(caseIds[1], [caseReports[1]]);
        await verifyCaseStatusForCase(caseIds[0], 'closed');
        await verifyCaseStatusForCase(caseIds[1], 'closed');
      });
    });
  });
});

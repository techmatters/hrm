"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockBeacon = exports.mockLastUpdateSeenParameter = void 0;
const addHours_1 = require("date-fns/addHours");
const subDays_1 = require("date-fns/subDays");
const testing_1 = require("@tech-matters/testing");
const ssm_cache_1 = require("@tech-matters/ssm-cache");
const hrm_service_test_support_1 = require("@tech-matters/hrm-service-test-support");
const jest_each_1 = __importDefault(require("jest-each"));
const dbConnection_1 = require("./dbConnection");
const config_1 = require("../../src/config");
const src_1 = require("../../src");
const date_fns_1 = require("date-fns");
const mockGenerators_1 = require("../mockGenerators");
const apiPayload_1 = require("../../src/caseReport/apiPayload");
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
const mockLastUpdateSeenParameter = async (mockttp) => {
    await (0, testing_1.mockSsmParameters)(mockttp, [
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
exports.mockLastUpdateSeenParameter = mockLastUpdateSeenParameter;
const generateCases = (numberToGenerate) => {
    return Promise.all(Array(numberToGenerate)
        .fill(0)
        .map(async () => {
        const newCaseResponse = await fetch(`${process.env.INTERNAL_HRM_URL}/internal/v0/accounts/${ACCOUNT_SID}/cases`, {
            method: 'POST',
            body: JSON.stringify({
                info: { summary: 'something' },
                definitionVersion: 'as-v1',
            }),
            headers: HRM_REQUEST_HEADERS,
        });
        if (!newCaseResponse.ok) {
            throw new Error(`Create case HTTP call failed: [${newCaseResponse.status}] ${await newCaseResponse.text()}`);
        }
        const newCase = await newCaseResponse.json();
        console.debug('Generated case:', newCase.id);
        return newCase.id;
    }));
};
let mockedBeaconEndpoint;
const generateIncidentReports = (numberToGenerate, intervalInHours, caseIds = [], start = BASELINE_DATE) => {
    const response = [];
    for (let i = 0; i < numberToGenerate; i++) {
        const indexInCurrentIteration = i % caseIds.length;
        const iteration = Math.floor(i / caseIds.length);
        response.push((0, mockGenerators_1.generateIncidentReport)({
            updated_at: (0, addHours_1.addHours)(start, (i + 1) * intervalInHours).toISOString(),
            ...(caseIds[indexInCurrentIteration]
                ? { case_id: caseIds[indexInCurrentIteration] }
                : {}),
            id: iteration,
            number: numberToGenerate - iteration,
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
                timestamps: {},
            })),
            caller_number: '1234567890',
            created_at: start.toISOString(),
        }));
    }
    return response;
};
const generateCaseReports = (numberToGenerate, intervalInHours, caseIds = [], start = BASELINE_DATE, completeReport = false) => {
    const response = [];
    for (let i = 0; i < numberToGenerate; i++) {
        const indexInCurrentIteration = i % caseIds.length;
        const iteration = Math.floor(i / caseIds.length);
        response.push((completeReport ? mockGenerators_1.generateCompleteCaseReport : mockGenerators_1.generateCaseReport)({
            updated_at: (0, addHours_1.addHours)(start, (i + 1) * intervalInHours).toISOString(),
            ...(caseIds[indexInCurrentIteration]
                ? { case_id: caseIds[indexInCurrentIteration] }
                : {}),
            id: iteration,
            contact_id: `contact-for-case-${caseIds[indexInCurrentIteration]}`,
        }));
    }
    return response;
};
const batch = (reports, batchSize) => {
    const batches = [];
    for (let i = 0; i < reports.length; i += batchSize) {
        batches.push(reports.slice(i, i + batchSize));
    }
    return batches;
};
let beaconMockPriority = 0;
const mockBeacon = async (mockttp, apiPath, responses) => {
    process.env.BEACON_BASE_URL = `http://127.0.0.1:${mockttp.port}/mock-beacon`;
    console.debug(`Mocking beacon endpoint: GET ${process.env.BEACON_BASE_URL}${apiPath} to respond with ${responses.length} responses`);
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
exports.mockBeacon = mockBeacon;
const verifyCaseOverviewForCase = async (caseId, expectedOverview) => {
    const record = await dbConnection_1.db.one(`SELECT "info" FROM public."Cases" WHERE "accountSid" = $<accountSid> AND "id" = $<caseId>`, {
        caseId,
        accountSid: ACCOUNT_SID,
    });
    expect(record.info).toStrictEqual({ ...expectedOverview, summary: 'something' });
};
const verifyCaseStatusForCase = async (caseId, expectedStatus) => {
    const record = await dbConnection_1.db.one(`SELECT "status" FROM public."Cases" WHERE "accountSid" = $<accountSid> AND "id" = $<caseId>`, {
        caseId,
        accountSid: ACCOUNT_SID,
    });
    expect(record.status).toStrictEqual(expectedStatus);
};
const verifyCaseSectionsForCase = (caseSectionType, sectionVerifier, expectedItemsSortComparer) => async (caseId, expectedItems) => {
    expectedItems.sort(expectedItemsSortComparer);
    const records = await dbConnection_1.db.manyOrNone(`SELECT "sectionId", "sectionTypeSpecificData" FROM public."CaseSections" WHERE "accountSid" = $<accountSid> AND "caseId" = $<caseId> AND "sectionType" = $<caseSectionType> ORDER BY "sectionId" ASC`, {
        caseId,
        accountSid: ACCOUNT_SID,
        caseSectionType,
    });
    expect(records.length).toBe(expectedItems.length);
    // Extremely basic check to ensure the records are in the correct order, detailed mapping verification is in incidentReport unit tests
    records.forEach((r, idx) => {
        sectionVerifier(r, expectedItems[idx]);
    });
};
afterAll(async () => {
    await testing_1.mockingProxy.stop();
});
beforeAll(async () => {
    await testing_1.mockingProxy.start();
    mockedBeaconEndpoint = await (0, exports.mockBeacon)(await testing_1.mockingProxy.mockttpServer(), 'incidentReport', []);
    await (0, exports.mockLastUpdateSeenParameter)(await testing_1.mockingProxy.mockttpServer());
});
beforeEach(async () => {
    await (0, hrm_service_test_support_1.clearAllTables)(dbConnection_1.db);
    await (0, ssm_cache_1.putSsmParameter)(LAST_INCIDENT_REPORT_SEEN_PARAMETER_NAME, (0, subDays_1.subDays)(BASELINE_DATE, 1).toISOString(), { overwrite: true });
    await (0, ssm_cache_1.putSsmParameter)(LAST_CASE_REPORT_SEEN_PARAMETER_NAME, (0, subDays_1.subDays)(BASELINE_DATE, 1).toISOString(), { overwrite: true });
});
describe('Beacon Polling Service', () => {
    (0, jest_each_1.default)([{ apiType: 'incidentReport' }, { apiType: 'caseReport' }]).describe('Polling logic', ({ apiType }) => {
        const apiPath = apiType === 'incidentReport'
            ? '/api/aselo/incidents/updates'
            : '/api/aselo/case_reports/updates';
        test(`[${apiType}] Returns less than the maximum records - doesn't query again`, async () => {
            const caseIds = await generateCases(4);
            if (apiType === 'incidentReport') {
                mockedBeaconEndpoint = await (0, exports.mockBeacon)(await testing_1.mockingProxy.mockttpServer(), apiPath, [generateIncidentReports(4, 1, caseIds)]);
            }
            else {
                mockedBeaconEndpoint = await (0, exports.mockBeacon)(await testing_1.mockingProxy.mockttpServer(), apiPath, [generateCaseReports(4, 1, caseIds)]);
            }
            await (0, src_1.handler)({ apiType });
            const beaconRequests = await mockedBeaconEndpoint.getSeenRequests();
            expect(beaconRequests.length).toBe(1);
            expect(beaconRequests[0].url).toBe(`${process.env.BEACON_BASE_URL}${apiPath}?updated_after=${encodeURIComponent((0, subDays_1.subDays)(BASELINE_DATE, 1).toISOString())}&limit=${MAX_ITEMS_PER_CALL}`);
            expect(beaconRequests[0].headers[config_1.BEACON_API_KEY_HEADER.toLowerCase()]).toBe(process.env.BEACON_API_KEY);
        });
        test(`[${apiType}] Returns the maximum records - queries again`, async () => {
            const caseIds = await generateCases(12);
            if (apiType === 'incidentReport') {
                mockedBeaconEndpoint = await (0, exports.mockBeacon)(await testing_1.mockingProxy.mockttpServer(), apiPath, batch(generateIncidentReports(12, 1, caseIds), MAX_ITEMS_PER_CALL));
            }
            else {
                mockedBeaconEndpoint = await (0, exports.mockBeacon)(await testing_1.mockingProxy.mockttpServer(), apiPath, batch(generateCaseReports(12, 1, caseIds), MAX_ITEMS_PER_CALL));
            }
            await (0, src_1.handler)({ apiType });
            const beaconRequests = await mockedBeaconEndpoint.getSeenRequests();
            expect(beaconRequests.length).toBe(3);
            expect(decodeURI(beaconRequests[0].url)).toBe(`${process.env.BEACON_BASE_URL}${apiPath}?updated_after=${encodeURIComponent((0, subDays_1.subDays)(BASELINE_DATE, 1).toISOString())}&limit=${MAX_ITEMS_PER_CALL}`);
            expect(decodeURI(beaconRequests[1].url)).toBe(`${process.env.BEACON_BASE_URL}${apiPath}?updated_after=${encodeURIComponent((0, addHours_1.addHours)(BASELINE_DATE, 5).toISOString())}&limit=${MAX_ITEMS_PER_CALL}`);
            expect(decodeURI(beaconRequests[2].url)).toBe(`${process.env.BEACON_BASE_URL}${apiPath}?updated_after=${encodeURIComponent((0, addHours_1.addHours)(BASELINE_DATE, 10).toISOString())}&limit=${MAX_ITEMS_PER_CALL}`);
        });
        test(`[${apiType}] Returns the maximum records for more than the maximum allowed number of queries in a polling sweep - stops querying`, async () => {
            const caseIds = await generateCases(30);
            if (apiType === 'incidentReport') {
                mockedBeaconEndpoint = await (0, exports.mockBeacon)(await testing_1.mockingProxy.mockttpServer(), apiPath, batch(generateIncidentReports(1000, 1, caseIds), MAX_ITEMS_PER_CALL));
            }
            else {
                mockedBeaconEndpoint = await (0, exports.mockBeacon)(await testing_1.mockingProxy.mockttpServer(), apiPath, batch(generateCaseReports(1000, 1, caseIds), MAX_ITEMS_PER_CALL));
            }
            await (0, src_1.handler)({ apiType });
            const beaconRequests = await mockedBeaconEndpoint.getSeenRequests();
            expect(beaconRequests.length).toBe(5);
        });
    });
    describe('HRM case updates', () => {
        describe('Incident Reports', () => {
            const verifyIncidentReportsForCase = verifyCaseSectionsForCase('incidentReport', (actual, expected) => {
                const { id: incidentReportId } = expected;
                expect(actual.sectionId).toBe(incidentReportId.toString());
            }, (ir1, ir2) => ir1.id - ir2.id);
            const respondersWithIncidentId = (incidentReport) => incidentReport.responders.map(responder => ({
                responder,
                incidentReportId: incidentReport.id,
            }));
            const verifyRespondersForCase = verifyCaseSectionsForCase('assignedResponder', (actual, { responder, incidentReportId, }) => {
                const { name, id } = responder;
                expect(actual.sectionId).toBe(`${incidentReportId}/${id}`);
                expect(actual.sectionTypeSpecificData).toMatchObject({
                    responderName: name,
                });
            }, ({ responder: r1 }, { responder: r2 }) => r1.name.localeCompare(r2.name));
            test('Single new incident reports for existing cases - adds all incidents', async () => {
                // Arrange
                const caseIds = await generateCases(2);
                const incidentReports = generateIncidentReports(2, 1, caseIds);
                mockedBeaconEndpoint = await (0, exports.mockBeacon)(await testing_1.mockingProxy.mockttpServer(), '/api/aselo/incidents/updates', [incidentReports]);
                // Act
                await (0, src_1.handler)({ apiType: 'incidentReport' });
                // Assert
                await verifyCaseOverviewForCase(caseIds[0], {
                    priority: 'Low',
                    operatingArea: 'Pasadena',
                });
                await verifyIncidentReportsForCase(caseIds[0], [incidentReports[0]]);
                await verifyRespondersForCase(caseIds[0], respondersWithIncidentId(incidentReports[0]));
                await verifyIncidentReportsForCase(caseIds[1], [incidentReports[1]]);
                await verifyRespondersForCase(caseIds[1], respondersWithIncidentId(incidentReports[1]));
            });
            test('Multiple new incident reports per case for existing cases - adds all incidents', async () => {
                // Arrange
                const caseIds = await generateCases(2);
                const incidentReports = generateIncidentReports(5, 1, caseIds);
                mockedBeaconEndpoint = await (0, exports.mockBeacon)(await testing_1.mockingProxy.mockttpServer(), '/api/aselo/incidents/updates', [incidentReports]);
                // Act
                await (0, src_1.handler)({ apiType: 'incidentReport' });
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
                    undefined,
                    caseIds[1],
                ]);
                mockedBeaconEndpoint = await (0, exports.mockBeacon)(await testing_1.mockingProxy.mockttpServer(), '/api/aselo/incidents/updates', [incidentReports]);
                // Act
                await (0, src_1.handler)({ apiType: 'incidentReport' });
                // Assert
                await verifyCaseOverviewForCase(caseIds[0], {
                    priority: 'Low',
                    operatingArea: 'Pasadena',
                });
                await verifyIncidentReportsForCase(caseIds[0], [incidentReports[0]]);
                await verifyRespondersForCase(caseIds[0], respondersWithIncidentId(incidentReports[0]));
                await verifyIncidentReportsForCase(caseIds[1], [incidentReports[2]]);
                await verifyRespondersForCase(caseIds[1], respondersWithIncidentId(incidentReports[2]));
            });
            test('Same incident multiple times in one batch - rejects all but first', async () => {
                // Arrange
                const caseIds = await generateCases(2);
                const incidentReports = generateIncidentReports(3, 2, caseIds);
                const updatedIncidentReport = {
                    ...generateIncidentReports(1, 5, caseIds)[0],
                    description: 'Updated incident',
                };
                mockedBeaconEndpoint = await (0, exports.mockBeacon)(await testing_1.mockingProxy.mockttpServer(), '/api/aselo/incidents/updates', [
                    [...incidentReports, updatedIncidentReport].sort((ir1, ir2) => (0, date_fns_1.parseISO)(ir1.updated_at).getTime() - (0, date_fns_1.parseISO)(ir2.updated_at).getTime()),
                ]);
                // Act
                await (0, src_1.handler)({ apiType: 'incidentReport' });
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
            const verifyCaseReportsForCase = verifyCaseSectionsForCase('caseReport', (actual, expected) => {
                const processedExpected = (0, apiPayload_1.restructureApiContent)(expected);
                expect(actual.sectionId).toEqual(processedExpected.id.toString());
                expect(actual.sectionTypeSpecificData.primaryDisposition).toEqual(processedExpected['Primary Disposition']?.['Select One']);
            }, (ir1, ir2) => ir1.id - ir2.id);
            const verifyPehForCase = verifyCaseSectionsForCase('personExperiencingHomelessness', (actual, expected) => {
                const processedExpected = (0, apiPayload_1.restructureApiContent)(expected);
                expect(actual.sectionId).toEqual(processedExpected.id.toString());
                expect(actual.sectionTypeSpecificData.firstName).toEqual(processedExpected.Demographics?.['First Name']);
            }, (ir1, ir2) => ir1.id - ir2.id);
            const verifySafetyPlanForCase = verifyCaseSectionsForCase('safetyPlan', (actual, expected) => {
                const processedExpected = (0, apiPayload_1.restructureApiContent)(expected);
                expect(actual.sectionId).toEqual(processedExpected.id.toString());
                expect(actual.sectionTypeSpecificData.distractions).toEqual(processedExpected['Safety Plan']?.['Write People or Places Here']);
            }, (ir1, ir2) => ir1.id - ir2.id);
            const verifySudSurveyForCase = verifyCaseSectionsForCase('sudSurvey', (actual, expected) => {
                const processedExpected = (0, apiPayload_1.restructureApiContent)(expected);
                const selections = processedExpected?.['Collaborative SUD Survey']?.['In the past 3 months, have you used any of the following substances (check all that apply)'] ?? {};
                expect(actual.sectionTypeSpecificData.substancesUsed).toEqual(Object.entries(selections)
                    .filter(([, checked]) => typeof checked === 'boolean' && checked)
                    .map(([substance]) => substance));
            }, (ir1, ir2) => ir1.id - ir2.id);
            test('Complete case report - adds 4 sections to a case', async () => {
                // Arrange
                const caseIds = await generateCases(2);
                const caseReports = generateCaseReports(2, 1, caseIds, BASELINE_DATE, true);
                mockedBeaconEndpoint = await (0, exports.mockBeacon)(await testing_1.mockingProxy.mockttpServer(), '/api/aselo/case_reports/updates', [caseReports]);
                // Act
                await (0, src_1.handler)({ apiType: 'caseReport' });
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

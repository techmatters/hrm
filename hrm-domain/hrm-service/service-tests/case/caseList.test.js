"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable jest/no-standalone-expect,no-await-in-loop */
const date_fns_1 = require("date-fns");
const jest_each_1 = __importDefault(require("jest-each"));
const caseApi = __importStar(require("@tech-matters/hrm-core/case/caseService"));
const caseService_1 = require("@tech-matters/hrm-core/case/caseService");
const sql_1 = require("@tech-matters/hrm-core/sql");
const caseValidation_1 = require("./caseValidation");
const contactDb = __importStar(require("@tech-matters/hrm-core/contact/contactDataAccess"));
const mocks = __importStar(require("../mocks"));
const contactService_1 = require("@tech-matters/hrm-core/contact/contactService");
const server_1 = require("../server");
const twilio_worker_auth_1 = require("@tech-matters/twilio-worker-auth");
const mocks_1 = require("../mocks");
const setupServiceTest_1 = require("../setupServiceTest");
const { case1, contact1, accountSid, workerSid, case2, case3 } = mocks;
const { request } = (0, setupServiceTest_1.setupServiceTests)(workerSid);
const insertSampleCases = async ({ sampleSize, accounts, helplines, workers = [workerSid], statuses = ['open'], cases = [{ case: case1, sections: {} }], contactNames = [{ firstName: 'Maria', lastName: 'Silva' }], contactNumbers = ['+1-202-555-0184'], createdAtGenerator = () => undefined, updatedAtGenerator = () => undefined, followUpDateGenerator = () => undefined, categoriesGenerator = () => undefined, }) => {
    const createdCasesAndContacts = [];
    for (let i = 0; i < sampleSize; i += 1) {
        const toCreate = {
            ...cases[i % cases.length]?.case,
            helpline: helplines[i % helplines.length],
            status: statuses[i % statuses.length],
            twilioWorkerId: workers[i % workers.length],
        };
        const createdAt = createdAtGenerator(i);
        if (createdAt) {
            toCreate.createdAt = createdAt;
        }
        else {
            delete toCreate.createdAt;
        }
        const updatedAt = updatedAtGenerator(i);
        if (updatedAt) {
            toCreate.updatedAt = updatedAt;
        }
        else {
            delete toCreate.updatedAt;
        }
        const followUpDate = followUpDateGenerator(i);
        if (typeof followUpDate !== 'undefined') {
            toCreate.info = toCreate.info ?? {};
            toCreate.info.followUpDate = followUpDate;
        }
        else if (toCreate.info) {
            delete toCreate.info.followUpDate;
        }
        let createdCase = await caseApi.createCase(toCreate, accounts[i % accounts.length], workers[i % workers.length], undefined, true);
        if (contactNames[i % contactNames.length]) {
            const contactToCreate = (0, caseValidation_1.fillNameAndPhone)({
                ...contact1,
                twilioWorkerId: workers[i % workers.length],
                helpline: helplines[i % helplines.length],
            }, contactNames[i % contactNames.length], contactNumbers[i % contactNumbers.length]);
            contactToCreate.timeOfContact = new Date().toISOString();
            contactToCreate.taskId = undefined;
            contactToCreate.channelSid = `CHANNEL_${i}`;
            contactToCreate.serviceSid = 'SERVICE_SID';
            const categories = categoriesGenerator(i);
            if (categories) {
                contactToCreate.rawJson = contactToCreate.rawJson ?? {
                    caseInformation: {},
                    categories: {},
                    callerInformation: {},
                    childInformation: {},
                    callType: '',
                };
                contactToCreate.rawJson.categories = categories;
            }
            else if (contactToCreate.rawJson) {
                delete contactToCreate.rawJson.categories;
            }
            const { contact: savedContact } = (await contactDb.create()(accounts[i % accounts.length], contactToCreate)).unwrap();
            await contactDb.connectToCase()(savedContact.accountSid, savedContact.id.toString(), createdCase.id.toString(), workerSid);
        }
        createdCase = await (0, mocks_1.populateCaseSections)(createdCase.id.toString(), cases[i % cases.length]?.sections ?? {}, accounts[i % accounts.length]);
        createdCasesAndContacts.push(createdCase);
    }
    return createdCasesAndContacts;
};
describe('/cases route', () => {
    const route = `/v0/accounts/${accountSid}/cases/list`;
    describe('GET', () => {
        test('should return 401', async () => {
            const response = await request.get(route);
            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authorization failed');
        });
        test('should return 200', async () => {
            const response = await request.post(route).set(server_1.headers);
            expect(response.status).toBe(200);
            expect(response.body).toStrictEqual({ cases: [], count: 0 });
        });
        describe('With single record', () => {
            let createdCase;
            beforeEach(async () => {
                createdCase = await caseApi.createCase(case1, accountSid, workerSid, undefined, true);
                const contactToCreate = (0, caseValidation_1.fillNameAndPhone)({
                    ...contact1,
                    twilioWorkerId: workerSid,
                    timeOfContact: new Date().toISOString(),
                    taskId: `TASK_SID`,
                    channelSid: `CHANNEL_SID`,
                    serviceSid: 'SERVICE_SID',
                    profileId: undefined,
                    identifierId: undefined,
                });
                contactToCreate.timeOfContact = new Date().toISOString();
                contactToCreate.taskId = `TASK_SID`;
                contactToCreate.channelSid = `CHANNEL_SID`;
                contactToCreate.serviceSid = 'SERVICE_SID';
                const createdContact = (await contactDb.create()(accountSid, contactToCreate)).unwrap().contact;
                await contactDb.connectToCase()(accountSid, createdContact.id.toString(), createdCase.id, workerSid);
                createdCase = await (0, caseService_1.getCase)(createdCase.id, accountSid, mocks_1.ALWAYS_CAN); // refresh case from DB now it has a contact connected
            });
            // eslint-disable-next-line jest/expect-expect
            test('should return 200 when populated', async () => {
                const response = await request.post(route).set(server_1.headers);
                (0, caseValidation_1.validateSingleCaseResponse)(response, createdCase);
            });
        });
        test(`with connectedContacts $description`, async () => {
            const createdCase = await caseApi.createCase(case1, accountSid, workerSid, undefined, true);
            const createdContact = await (0, contactService_1.createContact)(accountSid, workerSid, mocks.withTaskId, mocks_1.ALWAYS_CAN, true);
            await (0, contactService_1.connectContactToCase)(accountSid, String(createdContact.id), String(createdCase.id), {
                user: (0, twilio_worker_auth_1.newTwilioUser)(accountSid, workerSid, []),
                can: () => true,
            }, true);
            (0, server_1.useOpenRules)();
            const response = await request.post(route).set(server_1.headers).send({
                dateFrom: createdCase.createdAt,
                dateTo: createdCase.createdAt,
            });
            expect(response.status).toBe(200);
            expect(response.body.cases).toHaveLength(1);
        });
    });
    const households = {
        household: [
            {
                workerSid,
                section: {
                    sectionTypeSpecificData: {
                        firstName: 'Maria',
                        lastName: 'Silva',
                        phone1: '+1-202-555-0184',
                    },
                },
            },
            {
                workerSid,
                section: {
                    sectionTypeSpecificData: {
                        firstName: 'John',
                        lastName: 'Doe',
                    },
                },
            },
        ],
    };
    const perpetrators = {
        perpetrator: [
            {
                workerSid,
                section: {
                    sectionTypeSpecificData: {
                        firstName: 'Maria',
                        lastName: 'Silva',
                    },
                },
            },
            {
                workerSid,
                section: {
                    sectionTypeSpecificData: {
                        firstName: 'John',
                        lastName: 'Doe',
                        phone2: '+12025550184',
                    },
                },
            },
        ],
    };
    describe('/cases/list route', () => {
        describe('POST', () => {
            describe('3 sample records', () => {
                let createdCase1;
                let createdCase2;
                let createdCase3;
                const searchTestRunStart = new Date().toISOString();
                beforeEach(async () => {
                    let createdContact;
                    createdCase1 = await caseApi.createCase(case1, accountSid, workerSid, undefined, true);
                    createdCase1 = await (0, mocks_1.populateCaseSections)(createdCase1.id, households, accountSid);
                    createdCase2 = await caseApi.createCase({ ...case1, status: 'closed' }, accountSid, workerSid, undefined, true);
                    createdCase3 = await caseApi.createCase(case1, accountSid, workerSid, undefined, true);
                    createdCase3 = await (0, mocks_1.populateCaseSections)(createdCase3.id, perpetrators, accountSid);
                    const toCreate = (0, caseValidation_1.fillNameAndPhone)({ ...contact1, twilioWorkerId: workerSid });
                    toCreate.timeOfContact = new Date().toISOString();
                    toCreate.taskId = `TASK_SID`;
                    toCreate.channelSid = `CHANNEL_SID`;
                    toCreate.serviceSid = 'SERVICE_SID';
                    // Connects createdContact with createdCase2
                    createdContact = (await contactDb.create()(accountSid, toCreate)).unwrap()
                        .contact;
                    createdContact = await contactDb.connectToCase()(accountSid, createdContact.id.toString(), createdCase2.id, workerSid);
                    delete createdContact.csamReports;
                    delete createdContact.conversationMedia;
                    delete createdContact.referrals;
                    // Get case 2 again, now a contact is connected
                    createdCase2 = await caseApi.getCase(createdCase2.id, accountSid, mocks_1.ALWAYS_CAN);
                });
                test('should return 401', async () => {
                    const response = await request
                        .post(route)
                        .query({ limit: 20, offset: 0 })
                        .send({});
                    expect(response.status).toBe(401);
                    expect(response.body.error).toBe('Authorization failed');
                });
                (0, jest_each_1.default)([
                    {
                        description: 'When status specified, should return records that match',
                        body: {
                            helpline: 'helpline',
                            filters: {
                                statuses: ['open', 'closed'],
                            },
                        },
                    },
                    {
                        description: 'When date range specified, should return records that match',
                        body: {
                            helpline: 'helpline',
                            dateFrom: searchTestRunStart,
                            dateTo: new Date().toISOString(),
                        },
                    },
                ]).test('$description', async ({ body }) => {
                    const response = await request
                        .post(route)
                        .query({ limit: 20, offset: 0 })
                        .set(server_1.headers)
                        .send(body);
                    expect(response.status).toBe(200);
                    const ids = response.body.cases.map(c => c.id);
                    expect(ids).toContain(createdCase1.id);
                    expect(ids).toContain(createdCase2.id);
                    expect(ids).toContain(createdCase3.id);
                    expect(response.body.count).toBe(3);
                });
                test('should return 200 - search by status', async () => {
                    const body = {
                        helpline: 'helpline',
                        filters: {
                            statuses: ['closed'],
                        },
                    };
                    const response = await request
                        .post(route)
                        .query({ limit: 20, offset: 0 })
                        .set(server_1.headers)
                        .send(body);
                    (0, caseValidation_1.validateSingleCaseResponse)(response, createdCase2);
                });
                // eslint-disable-next-line jest/expect-expect
                test('should only return case with contact when closedCase flag set false', async () => {
                    const body = {
                        closedCases: false,
                    };
                    // M<ake sure case with contact has 'open' status so it returns
                    const updatedCase = await caseApi.updateCaseStatus(createdCase2.id, 'open', accountSid, mocks_1.ALWAYS_CAN, true);
                    const response = await request
                        .post(route)
                        .query({ limit: 20, offset: 0 })
                        .set(server_1.headers)
                        .send(body);
                    (0, caseValidation_1.validateSingleCaseResponse)(response, {
                        ...updatedCase,
                        precalculatedPermissions: { userOwnsContact: true },
                    });
                });
                // eslint-disable-next-line jest/expect-expect
                test('should not return closed case with contact when closedCase flag set false', async () => {
                    const body = {
                        closedCases: false,
                    };
                    const response = await request
                        .post(route)
                        .query({ limit: 20, offset: 0 })
                        .set(server_1.headers)
                        .send(body);
                    expect(response.body.cases.length).toBe(0);
                    expect(response.body.count).toBe(0);
                });
            });
            describe('Larger record set', () => {
                const baselineDate = new Date(2010, 6, 15);
                const accounts = ['ACCOUNT_SID_1', 'ACCOUNT_SID_2'];
                const helplines = ['helpline-1', 'helpline-2', 'helpline-3'];
                const SIMPLE_SAMPLE_CONFIG = {
                    accounts,
                    helplines,
                    sampleSize: 10,
                };
                const SEARCHABLE_CONTACT_PHONE_NUMBER_SAMPLE_CONFIG = {
                    ...SIMPLE_SAMPLE_CONFIG,
                    accounts: ['ACCOUNT_SID_1'],
                    contactNumbers: [undefined, '111 222 333', '444 555 666', '111 222 333'],
                };
                describe('Filter tests', () => {
                    const testCases = [
                        {
                            description: 'should return all cases for account when no helpline, limit or offset is specified',
                            searchRoute: `/v0/accounts/${accounts[0]}/cases/list`,
                            sampleConfig: SIMPLE_SAMPLE_CONFIG,
                            expectedCases: sampleCasesAndContacts => sampleCasesAndContacts
                                .filter(cas => cas.accountSid === accounts[0])
                                .sort((c1, c2) => parseInt(c2.id) - parseInt(c1.id)),
                            expectedTotalCount: 5,
                        },
                        {
                            description: 'should return all cases for account & helpline when helpline is specified',
                            searchRoute: `/v0/accounts/${accounts[0]}/cases/list`,
                            body: {
                                helpline: helplines[1],
                            },
                            sampleConfig: SIMPLE_SAMPLE_CONFIG,
                            expectedCases: sampleCasesAndContacts => sampleCasesAndContacts
                                .filter(cas => cas.accountSid === accounts[0] && cas.helpline === helplines[1])
                                .sort((c1, c2) => parseInt(c2.id) - parseInt(c1.id)),
                            expectedTotalCount: 1,
                        },
                        {
                            description: 'should return all cases for account & any specified helpline when multiple helplines are specified',
                            searchRoute: `/v0/accounts/${accounts[0]}/cases/list`,
                            body: {
                                filters: {
                                    helplines: [helplines[1], helplines[2]],
                                },
                            },
                            sampleConfig: SIMPLE_SAMPLE_CONFIG,
                            expectedCases: sampleCasesAndContacts => sampleCasesAndContacts
                                .filter(cas => cas.accountSid === accounts[0] &&
                                [helplines[1], helplines[2]].indexOf(cas.helpline) !== -1)
                                .sort((c1, c2) => parseInt(c2.id) - parseInt(c1.id)),
                            expectedTotalCount: 3,
                        },
                        {
                            description: 'should return first X cases when limit X is specified',
                            searchRoute: `/v0/accounts/${accounts[0]}/cases/list?limit=3`,
                            sampleConfig: SIMPLE_SAMPLE_CONFIG,
                            expectedCases: sampleCasesAndContacts => sampleCasesAndContacts
                                .filter(cas => cas.accountSid === accounts[0])
                                .sort((c1, c2) => parseInt(c2.id) - parseInt(c1.id))
                                .slice(0, 3),
                            expectedTotalCount: 5,
                        },
                        {
                            description: 'should return X cases, starting at Y when limit X and offset Y are specified',
                            searchRoute: `/v0/accounts/${accounts[0]}/cases/list?limit=2&offset=1`,
                            sampleConfig: SIMPLE_SAMPLE_CONFIG,
                            expectedCases: sampleCasesAndContacts => sampleCasesAndContacts
                                .filter(cas => cas.accountSid === accounts[0])
                                .sort((c1, c2) => parseInt(c2.id) - parseInt(c1.id))
                                .slice(1, 3),
                            expectedTotalCount: 5,
                        },
                        {
                            description: 'should return remaining cases, starting at Y when offset Y and no limit is specified',
                            searchRoute: `/v0/accounts/${accounts[0]}/cases/list?offset=2`,
                            sampleConfig: SIMPLE_SAMPLE_CONFIG,
                            expectedCases: sampleCasesAndContacts => sampleCasesAndContacts
                                .filter(cas => cas.accountSid === accounts[0])
                                .sort((c1, c2) => parseInt(c2.id) - parseInt(c1.id))
                                .slice(2),
                            expectedTotalCount: 5,
                        },
                        {
                            description: 'should apply offset and limit to filtered set when helpline filter is applied',
                            searchRoute: `/v0/accounts/${accounts[0]}/cases/list?limit=1&offset=1`,
                            body: {
                                helpline: helplines[0],
                            },
                            sampleConfig: SIMPLE_SAMPLE_CONFIG,
                            expectedCases: sampleCasesAndContacts => sampleCasesAndContacts
                                .filter(cas => cas.accountSid === accounts[0] && cas.helpline === helplines[0])
                                .sort((c1, c2) => parseInt(c2.id) - parseInt(c1.id))
                                .slice(1, 2),
                            expectedTotalCount: 2,
                        },
                        {
                            description: 'should order by ID ASC when this is specified in the query',
                            searchRoute: `/v0/accounts/${accounts[0]}/cases/list?sortBy=id&sortDirection=ASC`,
                            sampleConfig: SIMPLE_SAMPLE_CONFIG,
                            expectedCases: sampleCasesAndContacts => sampleCasesAndContacts
                                .filter(cas => cas.accountSid === accounts[0])
                                .sort((c1, c2) => parseInt(c1.id) - parseInt(c2.id)),
                            expectedTotalCount: 5,
                        },
                        {
                            description: 'should filter by specified statuses',
                            searchRoute: `/v0/accounts/${accounts[0]}/cases/list`,
                            body: {
                                filters: {
                                    statuses: ['other', 'closed'],
                                },
                            },
                            sampleConfig: {
                                ...SEARCHABLE_CONTACT_PHONE_NUMBER_SAMPLE_CONFIG,
                                statuses: ['open', 'closed', 'other'],
                            },
                            expectedCases: sampleCasesAndContacts => sampleCasesAndContacts
                                .filter(cas => ['other', 'closed'].indexOf(cas.status) !== -1)
                                .sort((c1, c2) => parseInt(c2.id) - parseInt(c1.id)),
                            expectedTotalCount: 6,
                        },
                        {
                            description: 'should filter by specified workers',
                            searchRoute: `/v0/accounts/${accounts[0]}/cases/list`,
                            body: {
                                filters: {
                                    counsellors: ['WK-worker-1', 'WK-worker-3'],
                                },
                            },
                            sampleConfig: {
                                ...SEARCHABLE_CONTACT_PHONE_NUMBER_SAMPLE_CONFIG,
                                workers: ['WK-worker-1', 'WK-worker-2', 'WK-worker-3', 'WK-worker-4'],
                            },
                            expectedCases: sampleCasesAndContacts => sampleCasesAndContacts
                                .filter(cas => ['WK-worker-1', 'WK-worker-3'].indexOf(cas.status) !== -1)
                                .sort((c1, c2) => parseInt(c2.id) - parseInt(c1.id)),
                            expectedTotalCount: 5,
                        },
                        {
                            description: 'should filter out cases with no contact if includeOrphans filter is set false',
                            searchRoute: `/v0/accounts/${accounts[0]}/cases/list`,
                            body: {
                                filters: {
                                    includeOrphans: false,
                                },
                            },
                            sampleConfig: {
                                ...SIMPLE_SAMPLE_CONFIG,
                                contactNames: [{ firstName: 'a', lastName: 'z' }, null],
                            },
                            expectedCases: sampleCasesAndContacts => sampleCasesAndContacts
                                .filter((cas, idx) => idx % 2 === 0)
                                .sort((c1, c2) => parseInt(c2.id) - parseInt(c1.id)),
                            expectedTotalCount: 5,
                        },
                        {
                            description: 'should only include cases with followUpDate prior to the followUpDate.to filter if specified',
                            searchRoute: `/v0/accounts/${accounts[0]}/cases/list`,
                            body: {
                                filters: {
                                    caseInfoFilters: {
                                        followUpDate: {
                                            to: (0, date_fns_1.add)(baselineDate, { days: 4, hours: 12 }).toISOString(),
                                        },
                                    },
                                },
                            },
                            sampleConfig: {
                                ...SEARCHABLE_CONTACT_PHONE_NUMBER_SAMPLE_CONFIG,
                                followUpDateGenerator: idx => (0, date_fns_1.addDays)(baselineDate, idx).toISOString(),
                            },
                            expectedCases: sampleCasesAndContacts => sampleCasesAndContacts
                                .filter(cas => new Date(cas.info.followUpDate) <
                                (0, date_fns_1.add)(baselineDate, { days: 4, hours: 12 }))
                                .sort((c1, c2) => parseInt(c2.id) - parseInt(c1.id)),
                            expectedTotalCount: 5,
                        },
                        {
                            description: 'should only include cases with followUpDate between the followUpDate.from and the followUpDate.to filter if both are specified',
                            searchRoute: `/v0/accounts/${accounts[0]}/cases/list`,
                            body: {
                                filters: {
                                    caseInfoFilters: {
                                        followUpDate: {
                                            from: (0, date_fns_1.add)(baselineDate, { days: 2, hours: 12 }).toISOString(),
                                            to: (0, date_fns_1.add)(baselineDate, { days: 6, hours: 12 }).toISOString(),
                                        },
                                    },
                                },
                            },
                            sampleConfig: {
                                ...SEARCHABLE_CONTACT_PHONE_NUMBER_SAMPLE_CONFIG,
                                followUpDateGenerator: idx => (0, date_fns_1.addDays)(baselineDate, idx).toISOString(),
                            },
                            expectedCases: sampleCasesAndContacts => sampleCasesAndContacts
                                .filter(cas => new Date(cas.info.followUpDate) >
                                (0, date_fns_1.add)(baselineDate, { days: 2, hours: 12 }) &&
                                new Date(cas.info.followUpDate) <
                                    (0, date_fns_1.add)(baselineDate, { days: 6, hours: 12 }))
                                .sort((c1, c2) => parseInt(c2.id) - parseInt(c1.id)),
                            expectedTotalCount: 4,
                        },
                        {
                            description: 'should exclude cases with followUpDate set as empty string if the followUpDate.from and the followUpDate.to filter if both are specified',
                            searchRoute: `/v0/accounts/${accounts[0]}/cases/list`,
                            body: {
                                filters: {
                                    caseInfoFilters: {
                                        followUpDate: {
                                            from: (0, date_fns_1.add)(baselineDate, { days: 2, hours: 12 }).toISOString(),
                                            to: (0, date_fns_1.add)(baselineDate, { days: 6, hours: 12 }).toISOString(),
                                        },
                                    },
                                },
                            },
                            sampleConfig: {
                                ...SEARCHABLE_CONTACT_PHONE_NUMBER_SAMPLE_CONFIG,
                                followUpDateGenerator: idx => idx % 2 ? '' : (0, date_fns_1.addDays)(baselineDate, idx).toISOString(),
                            },
                            expectedCases: sampleCasesAndContacts => sampleCasesAndContacts
                                .filter(cas => cas.info.followUpDate &&
                                new Date(cas.info.followUpDate) >
                                    (0, date_fns_1.add)(baselineDate, { days: 2, hours: 12 }) &&
                                new Date(cas.info.followUpDate) <
                                    (0, date_fns_1.add)(baselineDate, { days: 6, hours: 12 }))
                                .sort((c1, c2) => parseInt(c2.id) - parseInt(c1.id)),
                            expectedTotalCount: 2,
                        },
                        {
                            description: 'should only include cases without followUpDate set in followUpDate.exists: MUST_NOT_EXIST filter specified',
                            searchRoute: `/v0/accounts/${accounts[0]}/cases/list`,
                            body: {
                                filters: {
                                    caseInfoFilters: {
                                        followUpDate: {
                                            exists: sql_1.DateExistsCondition.MUST_NOT_EXIST,
                                        },
                                    },
                                },
                            },
                            sampleConfig: {
                                ...SEARCHABLE_CONTACT_PHONE_NUMBER_SAMPLE_CONFIG,
                                followUpDateGenerator: idx => idx % 2 === 1 ? (0, date_fns_1.addDays)(baselineDate, idx).toISOString() : undefined,
                            },
                            expectedCases: sampleCasesAndContacts => sampleCasesAndContacts
                                .filter(cas => !cas.info.followUpDate)
                                .sort((c1, c2) => parseInt(c2.id) - parseInt(c1.id)),
                            expectedTotalCount: 5,
                        },
                        {
                            description: 'should count an empty string value as not existing followUpDate.exists: MUST_NOT_EXIST filter specified',
                            searchRoute: `/v0/accounts/${accounts[0]}/cases/list`,
                            body: {
                                filters: {
                                    caseInfoFilters: {
                                        followUpDate: {
                                            exists: sql_1.DateExistsCondition.MUST_NOT_EXIST,
                                        },
                                    },
                                },
                            },
                            sampleConfig: {
                                ...SEARCHABLE_CONTACT_PHONE_NUMBER_SAMPLE_CONFIG,
                                followUpDateGenerator: idx => idx % 2 === 1 ? (0, date_fns_1.addDays)(baselineDate, idx).toISOString() : '',
                            },
                            expectedCases: sampleCasesAndContacts => sampleCasesAndContacts
                                .filter(cas => !cas.info.followUpDate)
                                .sort((c1, c2) => parseInt(c2.id) - parseInt(c1.id)),
                            expectedTotalCount: 5,
                        },
                        {
                            description: 'should not include cases with createdAt not between the createdAt.from and the createdAt.to filter if both are specified',
                            searchRoute: `/v0/accounts/${accounts[0]}/cases/list`,
                            body: {
                                filters: {
                                    createdAt: {
                                        from: (0, date_fns_1.add)(baselineDate, { days: 2, hours: 12 }).toISOString(),
                                        to: (0, date_fns_1.add)(baselineDate, { days: 6, hours: 12 }).toISOString(),
                                    },
                                },
                            },
                            sampleConfig: {
                                ...SEARCHABLE_CONTACT_PHONE_NUMBER_SAMPLE_CONFIG,
                                createdAtGenerator: idx => (0, date_fns_1.addDays)(baselineDate, idx).toISOString(),
                            },
                            expectedCases: () => [],
                            expectedTotalCount: 0,
                        },
                        {
                            description: 'should include cases with createdAt between the createdAt.from and the createdAt.to filter if both are specified',
                            searchRoute: `/v0/accounts/${accounts[0]}/cases/list`,
                            body: {
                                filters: {
                                    createdAt: {
                                        from: (0, date_fns_1.add)(baselineDate, { days: 2, hours: 12 }).toISOString(),
                                        to: (0, date_fns_1.add)(new Date(), { days: 6, hours: 12 }).toISOString(),
                                    },
                                },
                            },
                            sampleConfig: {
                                ...SEARCHABLE_CONTACT_PHONE_NUMBER_SAMPLE_CONFIG,
                                createdAtGenerator: idx => (0, date_fns_1.addDays)(baselineDate, idx).toISOString(),
                            },
                            expectedCases: sampleCasesAndContacts => sampleCasesAndContacts.sort((c1, c2) => parseInt(c2.id) - parseInt(c1.id)),
                            expectedTotalCount: 10,
                        },
                        {
                            description: 'should not include cases with updatedAt not between the updatedAt.from and the updatedAt.to filter if both are specified',
                            searchRoute: `/v0/accounts/${accounts[0]}/cases/list`,
                            body: {
                                filters: {
                                    updatedAt: {
                                        from: (0, date_fns_1.add)(baselineDate, { days: 2, hours: 12 }).toISOString(),
                                        to: (0, date_fns_1.add)(baselineDate, { days: 6, hours: 12 }).toISOString(),
                                    },
                                },
                            },
                            sampleConfig: {
                                ...SEARCHABLE_CONTACT_PHONE_NUMBER_SAMPLE_CONFIG,
                                updatedAtGenerator: idx => (0, date_fns_1.addDays)(baselineDate, idx).toISOString(),
                            },
                            expectedCases: () => [],
                            expectedTotalCount: 0,
                        },
                        {
                            description: 'should include cases with updatedAt between the updatedAt.from and the updatedAt.to filter if both are specified',
                            searchRoute: `/v0/accounts/${accounts[0]}/cases/list`,
                            body: {
                                filters: {
                                    updatedAt: {
                                        from: (0, date_fns_1.add)(baselineDate, { days: 2, hours: 12 }).toISOString(),
                                        to: (0, date_fns_1.add)(new Date(), { days: 6, hours: 12 }).toISOString(),
                                    },
                                },
                            },
                            sampleConfig: {
                                ...SEARCHABLE_CONTACT_PHONE_NUMBER_SAMPLE_CONFIG,
                                updatedAtGenerator: idx => (0, date_fns_1.addDays)(baselineDate, idx).toISOString(),
                            },
                            expectedCases: sampleCasesAndContacts => sampleCasesAndContacts.sort((c1, c2) => parseInt(c2.id) - parseInt(c1.id)),
                            expectedTotalCount: 10,
                        },
                        {
                            description: 'should return empty set if different HRM sub account specified',
                            searchRoute: `/v0/accounts/${accounts[0]}-other/cases/list`,
                            sampleConfig: SIMPLE_SAMPLE_CONFIG,
                            expectedCases: () => [],
                            expectedTotalCount: 0,
                        },
                        {
                            description: 'should filter cases by operatingArea using caseInfoFilters',
                            searchRoute: `/v0/accounts/${accounts[0]}/cases/list`,
                            body: {
                                filters: {
                                    caseInfoFilters: {
                                        operatingArea: ['East'],
                                    },
                                },
                            },
                            sampleConfig: {
                                ...SIMPLE_SAMPLE_CONFIG,
                                sampleSize: 10,
                                cases: [
                                    {
                                        case: { ...case1, info: { ...case1.info, operatingArea: 'East' } },
                                        sections: {},
                                    },
                                    {
                                        case: { ...case2, info: { ...case2.info, operatingArea: 'West' } },
                                        sections: {},
                                    },
                                    {
                                        case: { ...case3, info: { ...case3.info, operatingArea: 'East' } },
                                        sections: {},
                                    },
                                ],
                            },
                            expectedCases: sampleCasesAndContacts => sampleCasesAndContacts
                                .filter(cas => cas.accountSid === accounts[0] &&
                                cas.info?.operatingArea === 'East')
                                .sort((c1, c2) => parseInt(c2.id) - parseInt(c1.id)),
                            expectedTotalCount: 4,
                        },
                        {
                            description: 'should filter cases by multiple operatingArea values using caseInfoFilters',
                            searchRoute: `/v0/accounts/${accounts[0]}/cases/list`,
                            body: {
                                filters: {
                                    caseInfoFilters: {
                                        operatingArea: ['East', 'North'],
                                    },
                                },
                            },
                            sampleConfig: {
                                ...SIMPLE_SAMPLE_CONFIG,
                                cases: [
                                    {
                                        case: { ...case1, info: { ...case1.info, operatingArea: 'East' } },
                                        sections: {},
                                    },
                                    {
                                        case: { ...case2, info: { ...case2.info, operatingArea: 'West' } },
                                        sections: {},
                                    },
                                    {
                                        case: { ...case3, info: { ...case3.info, operatingArea: 'North' } },
                                        sections: {},
                                    },
                                ],
                            },
                            expectedCases: sampleCasesAndContacts => sampleCasesAndContacts
                                .filter(cas => cas.accountSid === accounts[0] &&
                                ['East', 'North'].includes(cas.info?.operatingArea))
                                .sort((c1, c2) => parseInt(c2.id) - parseInt(c1.id)),
                            expectedTotalCount: 4,
                        },
                        {
                            description: 'should combine caseInfoFilters with other filters correctly',
                            searchRoute: `/v0/accounts/${accounts[0]}/cases/list`,
                            body: {
                                helpline: helplines[0],
                                filters: {
                                    caseInfoFilters: {
                                        operatingArea: ['East'],
                                    },
                                },
                            },
                            sampleConfig: {
                                ...SIMPLE_SAMPLE_CONFIG,
                                cases: [
                                    {
                                        case: {
                                            ...case1,
                                            helpline: helplines[0],
                                            info: { ...case1.info, operatingArea: 'East' },
                                        },
                                        sections: {},
                                    },
                                    {
                                        case: {
                                            ...case1,
                                            helpline: helplines[1],
                                            info: { ...case1.info, operatingArea: 'East' },
                                        },
                                        sections: {},
                                    },
                                    {
                                        case: {
                                            ...case2,
                                            helpline: helplines[0],
                                            info: { ...case2.info, operatingArea: 'West' },
                                        },
                                        sections: {},
                                    },
                                ],
                            },
                            expectedCases: sampleCasesAndContacts => sampleCasesAndContacts
                                .filter(cas => cas.accountSid === accounts[0] &&
                                cas.helpline === helplines[0] &&
                                cas.info?.operatingArea === 'East')
                                .sort((c1, c2) => parseInt(c2.id) - parseInt(c1.id)),
                            expectedTotalCount: 2,
                        },
                    ];
                    let createdCasesAndContacts;
                    (0, jest_each_1.default)(testCases).test('$description', async ({ sampleConfig, body, searchRoute, expectedCases, expectedTotalCount, }) => {
                        createdCasesAndContacts = await insertSampleCases(sampleConfig);
                        const response = await request.post(searchRoute).set(server_1.headers).send(body);
                        (0, caseValidation_1.validateCaseListResponse)(response, expectedCases(createdCasesAndContacts), expectedTotalCount);
                    });
                });
            });
        });
        test(`with connectedContacts $description`, async () => {
            const createdCase = await caseApi.createCase(case1, accountSid, workerSid, undefined, true);
            const createdContact = await (0, contactService_1.createContact)(accountSid, workerSid, mocks.withTaskId, mocks_1.ALWAYS_CAN, true);
            await (0, contactService_1.connectContactToCase)(accountSid, String(createdContact.id), String(createdCase.id), {
                user: (0, twilio_worker_auth_1.newTwilioUser)(accountSid, workerSid, []),
                can: () => true,
            }, true);
            (0, server_1.useOpenRules)();
            const response = await request
                .post(route)
                .query({ limit: 20, offset: 0 })
                .set(server_1.headers)
                .send({
                dateFrom: createdCase.createdAt,
                dateTo: createdCase.createdAt,
                firstName: 'withTaskId',
            });
            expect(response.status).toBe(200);
            expect(response.body.cases).toHaveLength(1);
        });
    });
});

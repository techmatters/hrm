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
const jest_each_1 = __importDefault(require("jest-each"));
const mocks = __importStar(require("./mocks"));
require("./case/caseValidation");
const csamReportsApi = __importStar(require("@tech-matters/hrm-core/csam-report/csamReportService"));
const server_1 = require("./server");
const setupServiceTest_1 = require("./setupServiceTest");
const { accountSid, workerSid } = mocks;
const csamReport1 = {
    csamReportId: 'csam-report-id',
    twilioWorkerId: workerSid,
    contactId: undefined,
};
const { contact1 } = mocks;
const { request } = (0, setupServiceTest_1.setupServiceTests)();
describe('/csamReports', () => {
    const route = `/v0/accounts/${accountSid}/csamReports`;
    describe('POST', () => {
        test('should return 401', async () => {
            const response = await request.post(route).send(csamReport1);
            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authorization failed');
        });
        describe('Should return 422', () => {
            const testCases = [
                {
                    description: 'when reportType is defined but invalid',
                    csamReport: {
                        csamReportId: 'csam-report-id',
                        twilioWorkerId: workerSid,
                        reportType: 'invalid',
                    },
                },
                {
                    description: 'when reportType is undefined and no csamReportId is provided',
                    csamReport: {
                        twilioWorkerId: workerSid,
                    },
                },
                {
                    description: 'when reportType is "counsellor-generated" and no csamReportId is provided',
                    csamReport: {
                        twilioWorkerId: workerSid,
                        reportType: 'counsellor-generated',
                    },
                },
            ];
            (0, jest_each_1.default)(testCases).test('$description', async ({ csamReport }) => {
                const response = await request.post(route).set(server_1.headers).send(csamReport);
                expect(response.status).toBe(422);
            });
        });
        describe('Should return 200', () => {
            describe('with valid arguments', () => {
                const testCasesWithContact = [
                    // with contact
                    {
                        description: 'when reportType is "counsellor-generated", twilioWorkerId preset',
                        csamReport: {
                            twilioWorkerId: workerSid,
                            reportType: 'counsellor-generated',
                            csamReportId: 'csam-report-id',
                        },
                        contact: contact1,
                    },
                    {
                        description: 'when reportType is "self-generated", twilioWorkerId preset',
                        csamReport: {
                            twilioWorkerId: workerSid,
                            reportType: 'self-generated',
                        },
                        contact: contact1,
                    },
                    {
                        description: 'when reportType is "counsellor-generated", twilioWorkerId absent',
                        csamReport: {
                            reportType: 'counsellor-generated',
                            csamReportId: 'csam-report-id',
                        },
                    },
                    {
                        description: 'when reportType is "self-generated", twilioWorkerId absent',
                        csamReport: {
                            reportType: 'self-generated',
                        },
                    },
                ];
                const testCases = testCasesWithContact.flatMap(({ contact, description, ...rest }) => [
                    { ...rest, description: description + ' without contact' },
                    { ...rest, contact, description: description + ' with contact' },
                ]);
                (0, jest_each_1.default)(testCases).test('$description', async ({ csamReport, contact }) => {
                    let csamReportToSave;
                    if (contact) {
                        //Create a Contact for the contactId
                        const contactRoute = `/v0/accounts/${accountSid}/contacts`;
                        const contactResponse = await request
                            .post(contactRoute)
                            .set(server_1.headers)
                            .send(contact);
                        csamReportToSave = { ...csamReport, contactId: contactResponse.body.id };
                    }
                    else {
                        csamReportToSave = { ...csamReport };
                    }
                    const expected = {
                        ...csamReportToSave,
                        id: expect.anything(),
                        accountSid: accountSid,
                        updatedAt: expect.toParseAsDate(),
                        createdAt: expect.toParseAsDate(),
                    };
                    const response = await request.post(route).set(server_1.headers).send(csamReportToSave);
                    expect(response.status).toBe(200);
                    if (contact) {
                        expect(response.body.contactId).toBe(csamReportToSave.contactId);
                    }
                    else {
                        expect(response.body.contactId).not.toBeDefined();
                    }
                    const reportFromDB = await csamReportsApi.getCSAMReport(response.body.id, accountSid);
                    if (!reportFromDB) {
                        throw new Error('reportFromDB is undefined');
                    }
                    expect(reportFromDB).toEqual(expect.objectContaining(expected));
                    if (csamReport.reportType === 'counsellor-generated') {
                        expect(reportFromDB.csamReportId).toEqual(csamReport.csamReportId);
                        expect(reportFromDB.acknowledged).toBe(true);
                    }
                    else {
                        expect(reportFromDB.csamReportId).toBeDefined();
                        expect(reportFromDB.acknowledged).toBe(false);
                    }
                    if (csamReport.twilioWorkerId) {
                        expect(reportFromDB.twilioWorkerId).toBe(csamReport.twilioWorkerId);
                    }
                    else {
                        expect(reportFromDB.twilioWorkerId).toBe(null);
                    }
                });
            });
        });
        describe('Should return 500', () => {
            const testCases = [
                {
                    description: 'when reportType is "counsellor-generated"',
                    csamReport: {
                        twilioWorkerId: workerSid,
                        reportType: 'counsellor-generated',
                        csamReportId: 'csam-report-id',
                        contactId: '99999999',
                    },
                },
                {
                    description: 'when reportType is "self-generated"',
                    csamReport: {
                        twilioWorkerId: workerSid,
                        reportType: 'self-generated',
                        csamReportId: 'csam-report-id',
                        contactId: '99999999',
                    },
                },
            ];
            (0, jest_each_1.default)(testCases).test('Invalid contactId, $description', async ({ csamReport }) => {
                const response = await request.post(route).set(server_1.headers).send(csamReport);
                expect(response.status).toBe(500);
                expect(response.body.message).toContain('insert or update on table "CSAMReports" violates foreign key constraint "CSAMReports_contactId_accountSid_fkey"');
            });
            (0, jest_each_1.default)(testCases).test('Invalid accountSid, $description', async ({ csamReport }) => {
                //Create a Contact for the contactId
                const contactRoute = `/v0/accounts/${accountSid}/contacts`;
                const contactResponse = await request
                    .post(contactRoute)
                    .set(server_1.headers)
                    .send(contact1);
                let csamReportWithContactId = {
                    ...csamReport,
                    contactId: contactResponse.body.id,
                };
                const response = await request
                    .post(route.replace(accountSid, 'another-account-sid'))
                    .set(server_1.headers)
                    .send(csamReportWithContactId);
                expect(response.status).toBe(500);
                expect(response.body.message).toContain('insert or update on table "CSAMReports" violates foreign key constraint "CSAMReports_contactId_accountSid_fkey"');
            });
        });
    });
    describe('/:reportId', () => {
        describe('/acknowledge', () => {
            describe('POST', () => {
                describe('Should return 404', () => {
                    (0, jest_each_1.default)([
                        {
                            description: 'when reportId is a string',
                            reportId: 'a-string',
                        },
                        {
                            description: 'when reportId does not exists in DB',
                            reportId: 99999999,
                        },
                    ]).test('$description', async ({ reportId }) => {
                        const response = await request
                            .post(`${route}/${reportId}/acknowledge`)
                            .set(server_1.headers);
                        expect(response.status).toBe(404);
                    });
                });
                describe('Should return 200', () => {
                    const testCasesWithContact = [
                        {
                            description: 'with "counsellor-generated" is no-op',
                            csamReport: {
                                twilioWorkerId: workerSid,
                                reportType: 'counsellor-generated',
                                csamReportId: 'csam-report-id',
                            },
                            contact: contact1,
                        },
                        {
                            description: 'with "self-generated", sets "acknowledged" to TRUE',
                            csamReport: {
                                twilioWorkerId: workerSid,
                                reportType: 'self-generated',
                            },
                            contact: contact1,
                        },
                    ];
                    const testCases = testCasesWithContact.flatMap(({ contact, description, ...rest }) => [
                        { ...rest, description: description + ' without contact' },
                        { ...rest, contact, description: description + ' with contact' },
                    ]);
                    (0, jest_each_1.default)(testCases).test('$description', async ({ csamReport, contact }) => {
                        let csamReportToSave;
                        if (contact) {
                            //Create a Contact for the contactId
                            const contactRoute = `/v0/accounts/${accountSid}/contacts`;
                            const contactResponse = await request
                                .post(contactRoute)
                                .set(server_1.headers)
                                .send(contact);
                            csamReportToSave = { ...csamReport, contactId: contactResponse.body.id };
                        }
                        else {
                            csamReportToSave = { ...csamReport };
                        }
                        const createdReport = await csamReportsApi.createCSAMReport(csamReportToSave, accountSid);
                        const response = await request
                            .post(`${route}/${createdReport.id}/acknowledge`)
                            .set(server_1.headers)
                            .send({});
                        expect(response.status).toBe(200);
                        expect(response.body.acknowledged).toBe(true);
                    });
                });
            });
        });
    });
});

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
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyUpdateStatusRequest = void 0;
const mockGenerators_1 = require("../../mockGenerators");
const caseReport_1 = require("../../../src/caseReport");
require("@tech-matters/testing");
const types_1 = require("@tech-matters/types");
const node_assert_1 = require("node:assert");
const verifyAddSectionRequest_1 = require("../verifyAddSectionRequest");
const mockFetch = jest.fn();
global.fetch = mockFetch;
const verifyUpdateStatusRequest = (caseId, expectedStatus) => {
    expect(mockFetch.mock.calls.length).toBeGreaterThan(1);
    const [, ...subsequentCalls] = mockFetch.mock.calls;
    const call = subsequentCalls.find(([url]) => url ===
        `${process.env.INTERNAL_HRM_URL}/internal/v0/accounts/${process.env.ACCOUNT_SID}/cases/${caseId}/status`);
    if (!call) {
        throw new node_assert_1.AssertionError({
            message: `Expected request to put status not found`,
            actual: mockFetch.mock.calls,
        });
    }
    expect(call[1]).toStrictEqual({
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${process.env.STATIC_KEY}`,
        },
        body: expect.any(String),
    });
    let parsedJson = JSON.parse(call[1].body);
    expect(parsedJson).toStrictEqual({ status: expectedStatus });
};
exports.verifyUpdateStatusRequest = verifyUpdateStatusRequest;
describe('addCaseReportSectionsToAseloCase', () => {
    const caseReportWithCoreSection = (0, mockGenerators_1.generateCaseReport)({
        id: 1234,
        case_id: '5678',
        issue_report: ['issue1', 'issue2'],
        updated_at: 'Christmas time',
        content: {
            fields: [
                (0, mockGenerators_1.generateCaseReportSectionNode)('Primary Disposition', [
                    (0, mockGenerators_1.generateCaseReportTextValueNode)('Select One', '1234'),
                ]),
                (0, mockGenerators_1.generateCaseReportSectionNode)('Secondary Disposition', [
                    (0, mockGenerators_1.generateCaseReportSectionNode)('Tangible Resources Provided', [
                        (0, mockGenerators_1.generateCaseReportCheckboxValueNode)('tangerine', true),
                        (0, mockGenerators_1.generateCaseReportCheckboxValueNode)('orange', false),
                    ]),
                    (0, mockGenerators_1.generateCaseReportSectionNode)('Referral Provided', [
                        (0, mockGenerators_1.generateCaseReportCheckboxValueNode)('referral', true),
                    ]),
                    (0, mockGenerators_1.generateCaseReportSectionNode)('Services Obtained', [
                        (0, mockGenerators_1.generateCaseReportCheckboxValueNode)('service', true),
                        (0, mockGenerators_1.generateCaseReportCheckboxValueNode)('obtained', true),
                    ]),
                    (0, mockGenerators_1.generateCaseReportSectionNode)('Information Provided', [
                        (0, mockGenerators_1.generateCaseReportCheckboxValueNode)('some', true),
                        (0, mockGenerators_1.generateCaseReportCheckboxValueNode)('information', true),
                    ]),
                ]),
                (0, mockGenerators_1.generateCaseReportSectionNode)('Narrative / Summary ', [
                    (0, mockGenerators_1.generateCaseReportTextValueNode)('Behavior', 'Ill'),
                    (0, mockGenerators_1.generateCaseReportTextValueNode)('Intervention', 'Great'),
                    (0, mockGenerators_1.generateCaseReportTextValueNode)('Response', 'Music'),
                    (0, mockGenerators_1.generateCaseReportTextValueNode)('Plan', 'Nine'),
                ]),
                (0, mockGenerators_1.generateCaseReportSectionNode)('Issue Report', [
                    (0, mockGenerators_1.generateCaseReportCheckboxValueNode)('issue0', false),
                    (0, mockGenerators_1.generateCaseReportCheckboxValueNode)('issue1', true),
                    (0, mockGenerators_1.generateCaseReportCheckboxValueNode)('issue2', true),
                ]),
                (0, mockGenerators_1.generateCaseReportSectionNode)('Next Action', [
                    (0, mockGenerators_1.generateCaseReportTextValueNode)('Case Status', 'Closed: No-Follow Up'),
                ]),
            ],
        },
    });
    const completeCaseReport = (0, mockGenerators_1.generateCompleteCaseReport)({ id: 1234 });
    beforeEach(() => {
        jest.clearAllMocks();
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({}),
        });
    });
    test('Case report with only core case report sections - only adds a case report section', async () => {
        // Act
        const res = await (0, caseReport_1.addCaseReportSectionsToAseloCase)(caseReportWithCoreSection, 'something');
        // Assert
        (0, verifyAddSectionRequest_1.verifyAddSectionRequest)('5678', 'caseReport', {
            sectionId: '1234',
            sectionTypeSpecificData: {
                issueReport: ['issue1', 'issue2'],
                primaryDisposition: '1234',
                tangibleResourcesProvided: ['tangerine'],
                referralProvided: ['referral'],
                serviceObtained: ['service', 'obtained'],
                informationProvided: ['some', 'information'],
                behavior: 'Ill',
                plan: 'Nine',
                intervention: 'Great',
                response: 'Music',
            },
        });
        (0, exports.verifyUpdateStatusRequest)('5678', 'closed');
        expect(mockFetch).not.toHaveBeenCalledWith(`${process.env.INTERNAL_HRM_URL}/internal/v0/accounts/${process.env.ACCOUNT_SID}/cases/5678/sections/personExperiencingHomelessness`, expect.anything());
        expect(mockFetch).not.toHaveBeenCalledWith(`${process.env.INTERNAL_HRM_URL}/internal/v0/accounts/${process.env.ACCOUNT_SID}/cases/5678/sections/safetyPlan`, expect.anything());
        expect(mockFetch).not.toHaveBeenCalledWith(`${process.env.INTERNAL_HRM_URL}/internal/v0/accounts/${process.env.ACCOUNT_SID}/cases/5678/sections/sudSurvey`, expect.anything());
        if ((0, types_1.isOk)(res)) {
            expect(res.unwrap()).toEqual('Christmas time');
        }
        else {
            throw new node_assert_1.AssertionError({ message: 'Expected success result', actual: res });
        }
    });
    test('Case report with demographics additional case report property - adds a case report and a PEH section', async () => {
        // Arrange
        const caseReport = {
            ...caseReportWithCoreSection,
            content: {
                fields: [
                    ...caseReportWithCoreSection.content.fields,
                    (0, mockGenerators_1.generateCaseReportSectionNode)('Demographics', [
                        (0, mockGenerators_1.generateCaseReportTextValueNode)('First Name', 'Charlotte'),
                        (0, mockGenerators_1.generateCaseReportTextValueNode)('Last Name', 'Ballantyne'),
                        (0, mockGenerators_1.generateCaseReportTextValueNode)('Nickname', 'Charlie'),
                        (0, mockGenerators_1.generateCaseReportTextValueNode)('Date of Birth', '10-1-1990'),
                        (0, mockGenerators_1.generateCaseReportSectionNode)('Gender', [
                            (0, mockGenerators_1.generateCaseReportTextValueNode)('Select Gender', 'female'),
                        ]),
                        (0, mockGenerators_1.generateCaseReportTextValueNode)('Race/Ethnicity', 'white'),
                        (0, mockGenerators_1.generateCaseReportTextValueNode)('Language', 'English'),
                    ]),
                ],
            },
        };
        // Act
        const res = await (0, caseReport_1.addCaseReportSectionsToAseloCase)(caseReport, 'something');
        // Assert
        (0, verifyAddSectionRequest_1.verifyAddSectionRequest)('5678', 'caseReport', {
            sectionId: '1234',
            sectionTypeSpecificData: expect.anything(),
        });
        (0, verifyAddSectionRequest_1.verifyAddSectionRequest)('5678', 'personExperiencingHomelessness', {
            sectionId: '1234',
            sectionTypeSpecificData: {
                firstName: 'Charlotte',
                lastName: 'Ballantyne',
                nickname: 'Charlie',
                dateOfBirth: '10-1-1990',
                gender: 'female',
                race: 'white',
                language: 'English',
            },
        }, false);
        (0, exports.verifyUpdateStatusRequest)('5678', 'closed');
        expect(mockFetch).not.toHaveBeenCalledWith(`${process.env.INTERNAL_HRM_URL}/internal/v0/accounts/${process.env.ACCOUNT_SID}/cases/5678/sections/safetyPlan`, expect.anything());
        expect(mockFetch).not.toHaveBeenCalledWith(`${process.env.INTERNAL_HRM_URL}/internal/v0/accounts/${process.env.ACCOUNT_SID}/cases/5678/sections/sudSurvey`, expect.anything());
        if ((0, types_1.isOk)(res)) {
            expect(res.unwrap()).toEqual('Christmas time');
        }
        else {
            throw new node_assert_1.AssertionError({ message: 'Expected success result', actual: res });
        }
    });
    test('Case report with safety_plan additional case report property - adds a case report and a safety plan section', async () => {
        // Arrange
        const caseReport = {
            ...caseReportWithCoreSection,
            content: {
                fields: [
                    ...caseReportWithCoreSection.content.fields,
                    (0, mockGenerators_1.generateCaseReportSectionNode)('Safety Plan', [
                        (0, mockGenerators_1.generateCaseReportTextValueNode)('Write Signs Here', 'warning'),
                        (0, mockGenerators_1.generateCaseReportTextValueNode)('Write Strategies Here', 'coping'),
                        (0, mockGenerators_1.generateCaseReportTextValueNode)('Write People or Places Here', 'distractions'),
                        (0, mockGenerators_1.generateCaseReportTextValueNode)('Write Here', 'who'),
                        (0, mockGenerators_1.generateCaseReportTextValueNode)('Write Contact(s) Here', 'crisis'),
                        (0, mockGenerators_1.generateCaseReportTextValueNode)('Write How Here', 'safe'),
                    ]),
                ],
            },
        };
        // Act
        const res = await (0, caseReport_1.addCaseReportSectionsToAseloCase)(caseReport, 'something');
        // Assert
        (0, verifyAddSectionRequest_1.verifyAddSectionRequest)('5678', 'caseReport', {
            sectionId: '1234',
            sectionTypeSpecificData: expect.anything(),
        });
        expect(mockFetch).not.toHaveBeenCalledWith(`${process.env.INTERNAL_HRM_URL}/internal/v0/accounts/${process.env.ACCOUNT_SID}/cases/5678/sections/personExperiencingHomelessness`, expect.anything());
        (0, verifyAddSectionRequest_1.verifyAddSectionRequest)('5678', 'safetyPlan', {
            sectionId: '1234',
            sectionTypeSpecificData: {
                warningSigns: 'warning',
                copingStrategies: 'coping',
                distractions: 'distractions',
                whoCanHelp: 'who',
                crisisAgencies: 'crisis',
                safeEnvironment: 'safe',
            },
        }, false);
        (0, exports.verifyUpdateStatusRequest)('5678', 'closed');
        expect(mockFetch).not.toHaveBeenCalledWith(`${process.env.INTERNAL_HRM_URL}/internal/v0/accounts/${process.env.ACCOUNT_SID}/cases/5678/sections/sudSurvey`, expect.anything());
        if ((0, types_1.isOk)(res)) {
            expect(res.unwrap()).toEqual('Christmas time');
        }
        else {
            throw new node_assert_1.AssertionError({ message: 'Expected success result', actual: res });
        }
    });
    test('Case report with collaborative_sud_survey additional case report property - adds a case report and a sud survey section', async () => {
        // Arrange
        const caseReport = {
            ...caseReportWithCoreSection,
            content: {
                fields: [
                    ...caseReportWithCoreSection.content.fields,
                    (0, mockGenerators_1.generateCaseReportSectionNode)('Collaborative SUD Survey', [
                        (0, mockGenerators_1.generateCaseReportSectionNode)('In the past 3 months, have you used any of the following substances (check all that apply)', [
                            (0, mockGenerators_1.generateCaseReportCheckboxValueNode)('thing1', true),
                            (0, mockGenerators_1.generateCaseReportCheckboxValueNode)('thing2', true),
                            (0, mockGenerators_1.generateCaseReportTextValueNode)('Other Substances Used', 'other'),
                        ]),
                        (0, mockGenerators_1.generateCaseReportTextValueNode)('In the past 3 months, have you ever tried and failed to control, cut down, or stop using the substances listed above?', 'thing1'),
                        (0, mockGenerators_1.generateCaseReportTextValueNode)('Are you interested in treatment for substance use disorder? If yes, continue with survey.', 'much'),
                        (0, mockGenerators_1.generateCaseReportTextValueNode)('There are several options for substance use disorder treatment. Which are you interested in?', 'many treatments'),
                        (0, mockGenerators_1.generateCaseReportTextValueNode)('Do you have a pet(s)/service animal(s)?', 'yes'),
                        (0, mockGenerators_1.generateCaseReportTextValueNode)('What type of pet(s)/service animal(s)?', 'quasit'),
                        (0, mockGenerators_1.generateCaseReportTextValueNode)('Is separating from your pet(s)/service animal a barrier to participating in the pilot program?', 'cannot get rid of it, it follows me everywhere'),
                    ]),
                ],
            },
        };
        // Act
        const res = await (0, caseReport_1.addCaseReportSectionsToAseloCase)(caseReport, 'something');
        // Assert
        (0, verifyAddSectionRequest_1.verifyAddSectionRequest)('5678', 'caseReport', {
            sectionId: '1234',
            sectionTypeSpecificData: expect.anything(),
        });
        expect(mockFetch).not.toHaveBeenCalledWith(`${process.env.INTERNAL_HRM_URL}/internal/v0/accounts/${process.env.ACCOUNT_SID}/cases/5678/sections/personExperiencingHomelessness`, expect.anything());
        expect(mockFetch).not.toHaveBeenCalledWith(`${process.env.INTERNAL_HRM_URL}/internal/v0/accounts/${process.env.ACCOUNT_SID}/cases/5678/sections/safetyPlan`, expect.anything());
        (0, exports.verifyUpdateStatusRequest)('5678', 'closed');
        (0, verifyAddSectionRequest_1.verifyAddSectionRequest)('5678', 'sudSurvey', {
            sectionId: '1234',
            sectionTypeSpecificData: {
                substancesUsed: ['thing1', 'thing2'],
                otherSubstancesUsed: 'other',
                failedToControlSubstances: 'thing1',
                treatmentInterest: 'much',
                treatmentPreferences: 'many treatments',
                hasServiceAnimal: 'yes',
                petType: 'quasit',
                petSeparationBarrier: 'cannot get rid of it, it follows me everywhere',
            },
        }, false);
        if ((0, types_1.isOk)(res)) {
            expect(res.unwrap()).toEqual('Christmas time');
        }
        else {
            throw new node_assert_1.AssertionError({ message: 'Expected success result', actual: res });
        }
    });
    test('Case report with all additional case report data - adds a case report and all additional sections', async () => {
        // Act
        const res = await (0, caseReport_1.addCaseReportSectionsToAseloCase)(completeCaseReport, 'something');
        // Assert
        (0, verifyAddSectionRequest_1.verifyAddSectionRequest)('5678', 'caseReport', {
            sectionId: '1234',
            sectionTypeSpecificData: expect.anything(),
        });
        (0, verifyAddSectionRequest_1.verifyAddSectionRequest)('5678', 'personExperiencingHomelessness', {
            sectionId: '1234',
            sectionTypeSpecificData: expect.anything(),
        }, false);
        (0, verifyAddSectionRequest_1.verifyAddSectionRequest)('5678', 'safetyPlan', {
            sectionId: '1234',
            sectionTypeSpecificData: expect.anything(),
        }, false);
        (0, verifyAddSectionRequest_1.verifyAddSectionRequest)('5678', 'sudSurvey', {
            sectionId: '1234',
            sectionTypeSpecificData: expect.anything(),
        }, false);
        (0, exports.verifyUpdateStatusRequest)('5678', 'closed');
        if ((0, types_1.isOk)(res)) {
            expect(res.unwrap()).toEqual('Christmas time');
        }
        else {
            throw new node_assert_1.AssertionError({ message: 'Expected success result', actual: res });
        }
    });
    test("Adding case report section fails - doesn't try to add additional ones", async () => {
        // Arrange
        jest.clearAllMocks();
        mockFetch.mockResolvedValue({
            ok: false,
            status: 409,
            text: async () => 'splat',
        });
        // Act
        const res = await (0, caseReport_1.addCaseReportSectionsToAseloCase)(caseReportWithCoreSection, 'something');
        // Assert
        (0, verifyAddSectionRequest_1.verifyAddSectionRequest)('5678', 'caseReport', {
            sectionId: '1234',
            sectionTypeSpecificData: expect.anything(),
        });
        expect(mockFetch).not.toHaveBeenCalledWith(`${process.env.INTERNAL_HRM_URL}/internal/v0/accounts/${process.env.ACCOUNT_SID}/cases/5678/sections/personExperiencingHomelessness`, expect.anything());
        expect(mockFetch).not.toHaveBeenCalledWith(`${process.env.INTERNAL_HRM_URL}/internal/v0/accounts/${process.env.ACCOUNT_SID}/cases/5678/sections/safetyPlan`, expect.anything());
        expect(mockFetch).not.toHaveBeenCalledWith(`${process.env.INTERNAL_HRM_URL}/internal/v0/accounts/${process.env.ACCOUNT_SID}/cases/5678/sections/sudSurvey`, expect.anything());
        expect(mockFetch).not.toHaveBeenCalledWith(`${process.env.INTERNAL_HRM_URL}/internal/v0/accounts/${process.env.ACCOUNT_SID}/cases/5678/status`, expect.anything());
        if ((0, types_1.isErr)(res)) {
            expect(res.error.lastUpdated).toEqual('Christmas time');
        }
        else {
            throw new node_assert_1.AssertionError({ message: 'Expected error result', actual: res });
        }
    });
    test('Additional section fails - still adds other sections, reports all errors in  response', async () => {
        // Arrange
        jest.clearAllMocks();
        mockFetch.mockImplementation(async (url) => {
            if (url.toString().endsWith('personExperiencingHomelessness')) {
                return {
                    ok: false,
                    status: 409,
                    text: async () => 'splat',
                };
            }
            if (url.toString().endsWith('safetyPlan')) {
                return {
                    ok: false,
                    status: 500,
                    text: async () => 'splat',
                };
            }
            return {
                ok: true,
                status: 200,
                json: async () => ({}),
            };
        });
        // Act
        const res = await (0, caseReport_1.addCaseReportSectionsToAseloCase)(completeCaseReport, 'something');
        // Assert
        (0, verifyAddSectionRequest_1.verifyAddSectionRequest)('5678', 'caseReport', {
            sectionId: '1234',
            sectionTypeSpecificData: expect.anything(),
        });
        (0, verifyAddSectionRequest_1.verifyAddSectionRequest)('5678', 'personExperiencingHomelessness', {
            sectionId: '1234',
            sectionTypeSpecificData: expect.anything(),
        }, false);
        (0, verifyAddSectionRequest_1.verifyAddSectionRequest)('5678', 'safetyPlan', {
            sectionId: '1234',
            sectionTypeSpecificData: expect.anything(),
        }, false);
        (0, verifyAddSectionRequest_1.verifyAddSectionRequest)('5678', 'sudSurvey', {
            sectionId: '1234',
            sectionTypeSpecificData: expect.anything(),
        }, false);
        (0, exports.verifyUpdateStatusRequest)('5678', 'closed');
        if ((0, types_1.isErr)(res)) {
            expect(res.error.lastUpdated).toEqual('Christmas time');
            const error = res.error;
            expect(error.type).toBe('AggregateError');
            expect(error.errors).toHaveLength(2);
            expect(error.errors[0].error.type).toBe('SectionExists');
            expect(error.errors[0].error.caseId).toBe('5678');
            expect(error.errors[0].error.sectionId).toBe('1234');
            expect(error.errors[1].error.type).toBe('UnexpectedHttpError');
            expect(error.errors[1].error.status).toBe(500);
            expect(error.errors[1].error.body).toBe('splat');
        }
        else {
            throw new node_assert_1.AssertionError({ message: 'Expected error result', actual: res });
        }
    });
});

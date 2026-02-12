"use strict";
/* eslint-disable @typescript-eslint/naming-convention */
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
exports.addCaseReportSectionsToAseloCase = void 0;
const caseUpdater_1 = require("../caseUpdater");
const types_1 = require("@tech-matters/types");
const apiPayload_1 = require("./apiPayload");
const BEACON_TO_ASELO_STATUS_MAP = {
    '-': 'open',
    'Closed: No-Follow Up': 'closed',
    'Response Team Follow Up': 'responseTeamFollowUp',
    'Support Team Follow Up': 'supportTeamFollowUp',
    'Managed By Support Team': 'managedBySupportTeam',
};
const checkboxMapToArray = (checkboxMap) => Object.entries(checkboxMap || {})
    .filter(([, checked]) => typeof checked === 'boolean' && checked)
    .map(([key]) => key);
const caseReportToCaseReportCaseSection = ({ id, case_id, updated_at, 'Primary Disposition': primaryDisposition, 'Secondary Disposition': secondaryDisposition, 'Issue Report': issueReport, 'Narrative / Summary ': narrative, }) => {
    const { Behavior: behavior, Intervention: intervention, Response: response, Plan: plan, } = narrative || {};
    const { 'Tangible Resources Provided': tangibleResourcesProvided, 'Information Provided': informationProvided, 'Referral Provided': referralProvided, 'Services Obtained': serviceObtained, } = secondaryDisposition || {};
    return {
        caseId: case_id,
        lastUpdated: updated_at,
        section: {
            sectionId: id.toString(),
            sectionTypeSpecificData: {
                primaryDisposition: primaryDisposition?.['Select One'] || null,
                tangibleResourcesProvided: checkboxMapToArray(tangibleResourcesProvided),
                informationProvided: checkboxMapToArray(informationProvided),
                referralProvided: checkboxMapToArray(referralProvided),
                serviceObtained: checkboxMapToArray(serviceObtained),
                issueReport: checkboxMapToArray(issueReport),
                behavior,
                intervention,
                response,
                plan,
            },
        },
    };
};
const caseReportToPehCaseSection = ({ id, case_id, updated_at, Demographics: demographics, }) => {
    const { 'First Name': firstName, 'Last Name': lastName, Nickname: nickname, 'Date of Birth': dateOfBirth, Gender: genderOptions, 'Race/Ethnicity': race, Language: language, 'Language Other': languageOther, } = demographics || {};
    const { 'Select Gender': gender } = genderOptions || {};
    return {
        caseId: case_id,
        lastUpdated: updated_at,
        section: {
            sectionId: id.toString(),
            sectionTypeSpecificData: {
                firstName,
                lastName,
                nickname,
                dateOfBirth,
                gender,
                race,
                language: languageOther || language,
            },
        },
    };
};
const caseReportToSafetyPlanCaseSection = ({ id, case_id, updated_at, 'Safety Plan': safetyPlan, }) => {
    const { 'Write Signs Here': warningSigns, 'Write Strategies Here': copingStrategies, 'Write How Here': safeEnvironment, 'Write People or Places Here': distractions, 'Write Contact(s) Here': crisisAgencies, 'Write Here': whoCanHelp, } = safetyPlan || {};
    return {
        caseId: case_id,
        lastUpdated: updated_at,
        section: {
            sectionId: id.toString(),
            sectionTypeSpecificData: {
                warningSigns,
                copingStrategies,
                distractions,
                whoCanHelp,
                crisisAgencies,
                safeEnvironment,
            },
        },
    };
};
const caseReportToSudSurveyCaseSection = ({ id, case_id, updated_at, 'Collaborative SUD Survey': collaborativeSudSurvey, }) => {
    const { 'In the past 3 months, have you used any of the following substances (check all that apply)': substancesUsed, 'In the past 3 months, have you ever tried and failed to control, cut down, or stop using the substances listed above?': failedToControlSubstances, 'Are you interested in treatment for substance use disorder? If yes, continue with survey.': treatmentInterest, 'There are several options for substance use disorder treatment. Which are you interested in?': treatmentPreferences, 'Do you have a pet(s)/service animal(s)?': hasServiceAnimal, 'What type of pet(s)/service animal(s)?': petType, 'Is separating from your pet(s)/service animal a barrier to participating in the pilot program?': petSeparationBarrier, } = collaborativeSudSurvey || {};
    return {
        caseId: case_id,
        lastUpdated: updated_at,
        section: {
            sectionId: id.toString(),
            sectionTypeSpecificData: {
                substancesUsed: checkboxMapToArray(substancesUsed),
                otherSubstancesUsed: Object.values(substancesUsed ?? {})
                    .filter(v => typeof v === 'string')
                    .join(', ') || null,
                failedToControlSubstances,
                treatmentInterest,
                treatmentPreferences,
                hasServiceAnimal,
                petType,
                petSeparationBarrier,
            },
        },
    };
};
const addCaseReportSectionToAseloCase = (0, caseUpdater_1.addSectionToAseloCase)('caseReport', caseReportToCaseReportCaseSection);
const addPehSectionToAseloCase = (0, caseUpdater_1.addDependentSectionToAseloCase)('personExperiencingHomelessness', caseReportToPehCaseSection);
const addSafetyPlanSectionToAseloCase = (0, caseUpdater_1.addDependentSectionToAseloCase)('safetyPlan', caseReportToSafetyPlanCaseSection);
const addSudSurveySectionToAseloCase = (0, caseUpdater_1.addDependentSectionToAseloCase)('sudSurvey', caseReportToSudSurveyCaseSection);
const addCaseReportSectionsToAseloCase = async (rawCaseReport, lastSeen) => {
    const caseReport = (0, apiPayload_1.restructureApiContent)(rawCaseReport);
    const caseReportResult = await addCaseReportSectionToAseloCase(caseReport, lastSeen);
    if ((0, types_1.isOk)(caseReportResult)) {
        const additionalSectionsResults = [];
        if (caseReport.Demographics) {
            additionalSectionsResults.push(addPehSectionToAseloCase(caseReport));
        }
        if (caseReport['Collaborative SUD Survey']) {
            additionalSectionsResults.push(addSudSurveySectionToAseloCase(caseReport));
        }
        if (caseReport['Safety Plan']) {
            additionalSectionsResults.push(addSafetyPlanSectionToAseloCase(caseReport));
        }
        const results = await Promise.all(additionalSectionsResults);
        const status = caseReport['Next Action']?.['Case Status'];
        if (caseReport.case_id && status) {
            if (BEACON_TO_ASELO_STATUS_MAP[status]) {
                const caseStatusUpdateResult = await (0, caseUpdater_1.updateAseloCaseStatus)(caseReport.case_id, BEACON_TO_ASELO_STATUS_MAP[status]);
                results.push(caseStatusUpdateResult);
                // The starting value of the dropdown is 'Select', not sure if it ever comes through the API?
            }
            else if (status !== 'Select') {
                results.push((0, types_1.newErr)({
                    message: 'Invalid case status',
                    error: {
                        type: 'InvalidCaseStatus',
                        level: 'error',
                        status,
                    },
                }));
            }
            else {
                console.debug('No case status provided, so no update being made');
            }
        }
        const errors = (await Promise.all(results)).filter(types_1.isErr);
        if (errors.length) {
            return (0, types_1.newErr)({
                message: 'Failed to add additional sections from case report to Aselo case',
                error: {
                    type: 'AggregateError',
                    level: 'error',
                    lastUpdated: caseReportResult.unwrap(),
                    errors,
                },
            });
        }
    }
    return caseReportResult;
};
exports.addCaseReportSectionsToAseloCase = addCaseReportSectionsToAseloCase;

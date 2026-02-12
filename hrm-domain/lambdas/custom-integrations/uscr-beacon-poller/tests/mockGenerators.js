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
exports.generateCompleteCaseReport = exports.generateCaseReport = exports.generateCaseReportSectionNode = exports.generateCaseReportCheckboxValueNode = exports.generateCaseReportTextValueNode = exports.generateIncidentReport = void 0;
const EMPTY_INCIDENT_REPORT = {
    number: 0,
    priority: '',
    address: '',
    caller_name: '',
    caller_number: '',
    case_id: undefined,
    category: null,
    category_id: 0,
    contact_id: null,
    created_at: '',
    description: '',
    id: undefined,
    class: '',
    latitude: 0,
    longitude: 0,
    status: '',
    transport_destination: '',
    number_of_patient_transports: 0,
    updated_at: '',
    responders: [],
    tags: [],
    comment: null,
    activation_interval: null,
    enroute_time_interval: null,
    scene_arrival_interval: null,
    triage_interval: null,
    total_scene_interval: null,
    transport_interval: null,
    total_incident_interval: null,
};
const generateIncidentReport = (patch) => ({
    ...EMPTY_INCIDENT_REPORT,
    ...patch,
});
exports.generateIncidentReport = generateIncidentReport;
const EMPTY_CASE_REPORT = {
    case_id: undefined,
    created_at: '',
    id: undefined,
    content: {
        fields: [],
    },
    updated_at: '',
    incident_id: 0,
};
const generateCaseReportTextValueNode = (label, value, type = 'text_field') => ({
    label,
    type: type,
    value,
    fields: null,
});
exports.generateCaseReportTextValueNode = generateCaseReportTextValueNode;
const generateCaseReportCheckboxValueNode = (label, value) => ({
    label,
    type: 'checkbox',
    value: value ? label : 'false',
    fields: null,
});
exports.generateCaseReportCheckboxValueNode = generateCaseReportCheckboxValueNode;
const generateCaseReportSectionNode = (label, fields) => ({
    label,
    type: 'section',
    value: null,
    fields,
});
exports.generateCaseReportSectionNode = generateCaseReportSectionNode;
const generateCaseReport = (patch) => ({
    ...EMPTY_CASE_REPORT,
    ...patch,
});
exports.generateCaseReport = generateCaseReport;
const generateCompleteCaseReport = (patch) => ({
    ...EMPTY_CASE_REPORT,
    case_id: '5678',
    issue_report: ['issue1', 'issue2'],
    updated_at: 'Christmas time',
    content: {
        fields: [
            (0, exports.generateCaseReportSectionNode)('Primary Disposition', [
                (0, exports.generateCaseReportTextValueNode)('Select One', '1234'),
            ]),
            (0, exports.generateCaseReportSectionNode)('Secondary Disposition', [
                (0, exports.generateCaseReportSectionNode)('Tangible Resources Provided', [
                    (0, exports.generateCaseReportCheckboxValueNode)('tangerine', true),
                    (0, exports.generateCaseReportCheckboxValueNode)('orange', false),
                ]),
                (0, exports.generateCaseReportSectionNode)('Referral Provided', [
                    (0, exports.generateCaseReportCheckboxValueNode)('referral', true),
                ]),
                (0, exports.generateCaseReportSectionNode)('Services Obtained', [
                    (0, exports.generateCaseReportCheckboxValueNode)('service', true),
                    (0, exports.generateCaseReportCheckboxValueNode)('obtained', true),
                ]),
                (0, exports.generateCaseReportSectionNode)('Information Provided', [
                    (0, exports.generateCaseReportCheckboxValueNode)('some', true),
                    (0, exports.generateCaseReportCheckboxValueNode)('information', true),
                ]),
            ]),
            (0, exports.generateCaseReportSectionNode)('Issue Report', [
                (0, exports.generateCaseReportCheckboxValueNode)('issue0', false),
                (0, exports.generateCaseReportCheckboxValueNode)('issue1', true),
                (0, exports.generateCaseReportCheckboxValueNode)('issue2', true),
            ]),
            (0, exports.generateCaseReportSectionNode)('Narrative / Summary ', [
                (0, exports.generateCaseReportTextValueNode)('Behavior', 'Ill'),
                (0, exports.generateCaseReportTextValueNode)('Intervention', 'Great'),
                (0, exports.generateCaseReportTextValueNode)('Response', 'Music'),
                (0, exports.generateCaseReportTextValueNode)('Plan', 'Nine'),
            ]),
            (0, exports.generateCaseReportSectionNode)('Demographics', [
                (0, exports.generateCaseReportTextValueNode)('First Name', 'Charlotte'),
                (0, exports.generateCaseReportTextValueNode)('Last Name', 'Ballantyne'),
                (0, exports.generateCaseReportTextValueNode)('Nickname', 'Charlie'),
                (0, exports.generateCaseReportTextValueNode)('Date of Birth', '10-1-1990'),
                (0, exports.generateCaseReportSectionNode)('Gender', [
                    (0, exports.generateCaseReportTextValueNode)('Select Gender', 'female'),
                ]),
                (0, exports.generateCaseReportTextValueNode)('Race/Ethnicity', 'white'),
                (0, exports.generateCaseReportTextValueNode)('Language', 'English'),
            ]),
            (0, exports.generateCaseReportSectionNode)('Safety Plan', [
                (0, exports.generateCaseReportTextValueNode)('Write Signs Here', 'warning'),
                (0, exports.generateCaseReportTextValueNode)('Write Strategies Here', 'coping'),
                (0, exports.generateCaseReportTextValueNode)('Write People or Places Here', 'distractions'),
                (0, exports.generateCaseReportTextValueNode)('Write Here', 'who'),
                (0, exports.generateCaseReportTextValueNode)('Write Contact(s) Here', 'crisis'),
                (0, exports.generateCaseReportTextValueNode)('Write How Here', 'safe'),
            ]),
            (0, exports.generateCaseReportSectionNode)('Collaborative SUD Survey', [
                (0, exports.generateCaseReportSectionNode)('In the past 3 months, have you used any of the following substances (check all that apply)', [
                    (0, exports.generateCaseReportCheckboxValueNode)('thing1', true),
                    (0, exports.generateCaseReportCheckboxValueNode)('thing2', true),
                    (0, exports.generateCaseReportTextValueNode)('Other Substances Used', 'other'),
                ]),
                (0, exports.generateCaseReportTextValueNode)('In the past 3 months, have you ever tried and failed to control, cut down, or stop using the substances listed above?', 'thing1'),
                (0, exports.generateCaseReportTextValueNode)('Are you interested in treatment for substance use disorder? If yes, continue with survey.', 'much'),
                (0, exports.generateCaseReportTextValueNode)('There are several options for substance use disorder treatment. Which are you interested in?', 'many treatments'),
                (0, exports.generateCaseReportTextValueNode)('Do you have a pet(s)/service animal(s)?', 'yes'),
                (0, exports.generateCaseReportTextValueNode)('What type of pet(s)/service animal(s)?', 'quasit'),
                (0, exports.generateCaseReportTextValueNode)('Is separating from your pet(s)/service animal a barrier to participating in the pilot program?', 'cannot get rid of it, it follows me everywhere'),
            ]),
            (0, exports.generateCaseReportSectionNode)('Next Action', [
                (0, exports.generateCaseReportTextValueNode)('Case Status', 'Closed: No-Follow Up'),
            ]),
        ],
    },
    ...patch,
});
exports.generateCompleteCaseReport = generateCompleteCaseReport;

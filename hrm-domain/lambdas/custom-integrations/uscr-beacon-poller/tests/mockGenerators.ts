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

import { IncidentReport } from '../src/incidentReport';
import {
  CaseReportContentNode,
  RawCaseReportApiPayload,
} from '../src/caseReport/apiPayload';

const EMPTY_INCIDENT_REPORT: IncidentReport = {
  number: 0,
  priority: '',
  address: '',
  caller_name: '',
  caller_number: '',
  case_id: undefined as any,
  category: null,
  category_id: 0,
  contact_id: null,
  created_at: '',
  description: '',
  id: undefined as any,
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

export const generateIncidentReport = (
  patch: Partial<IncidentReport> & Pick<IncidentReport, 'id'>,
): IncidentReport => ({
  ...EMPTY_INCIDENT_REPORT,
  ...patch,
});

const EMPTY_CASE_REPORT: RawCaseReportApiPayload = {
  case_id: undefined as any,
  created_at: '',
  id: undefined as any,
  content: {
    fields: [],
  },
  updated_at: '',
  incident_id: 0,
};

export const generateCaseReportTextValueNode = (
  label: string,
  value: string | null,
  type: Omit<CaseReportContentNode['type'], 'section'> = 'text_field',
): CaseReportContentNode => ({
  label,
  type: type as CaseReportContentNode['type'],
  value,
  fields: null,
});
export const generateCaseReportCheckboxValueNode = (
  label: string,
  value: boolean,
): CaseReportContentNode => ({
  label,
  type: 'checkbox',
  value: value ? label : 'false',
  fields: null,
});

export const generateCaseReportSectionNode = (
  label: string,
  fields: CaseReportContentNode[],
): CaseReportContentNode => ({
  label,
  type: 'section',
  value: null,
  fields,
});

export const generateCaseReport = (
  patch: Partial<RawCaseReportApiPayload> & Pick<RawCaseReportApiPayload, 'id'>,
): RawCaseReportApiPayload => ({
  ...EMPTY_CASE_REPORT,
  ...patch,
});

export const generateCompleteCaseReport = (
  patch: Partial<RawCaseReportApiPayload> & Pick<RawCaseReportApiPayload, 'id'>,
): RawCaseReportApiPayload => ({
  ...EMPTY_CASE_REPORT,
  case_id: '5678',
  issue_report: ['issue1', 'issue2'],
  updated_at: 'Christmas time',
  content: {
    fields: [
      generateCaseReportSectionNode('Primary Disposition', [
        generateCaseReportTextValueNode('Select One', '1234'),
      ]),
      generateCaseReportSectionNode('Secondary Disposition', [
        generateCaseReportSectionNode('Tangible Resources Provided', [
          generateCaseReportCheckboxValueNode('tangerine', true),
          generateCaseReportCheckboxValueNode('orange', false),
        ]),
        generateCaseReportSectionNode('Referral Provided', [
          generateCaseReportCheckboxValueNode('referral', true),
        ]),
        generateCaseReportSectionNode('Services Obtained', [
          generateCaseReportCheckboxValueNode('service', true),
          generateCaseReportCheckboxValueNode('obtained', true),
        ]),
        generateCaseReportSectionNode('Information Provided', [
          generateCaseReportCheckboxValueNode('some', true),
          generateCaseReportCheckboxValueNode('information', true),
        ]),
      ]),
      generateCaseReportSectionNode('Issue Report', [
        generateCaseReportCheckboxValueNode('issue0', false),
        generateCaseReportCheckboxValueNode('issue1', true),
        generateCaseReportCheckboxValueNode('issue2', true),
      ]),
      generateCaseReportSectionNode('Narrative / Summary ', [
        generateCaseReportTextValueNode('Behavior', 'Ill'),
        generateCaseReportTextValueNode('Intervention', 'Great'),
        generateCaseReportTextValueNode('Response', 'Music'),
        generateCaseReportTextValueNode('Plan', 'Nine'),
      ]),
      generateCaseReportSectionNode('Demographics', [
        generateCaseReportTextValueNode('First Name', 'Charlotte'),
        generateCaseReportTextValueNode('Last Name', 'Ballantyne'),
        generateCaseReportTextValueNode('Nickname', 'Charlie'),
        generateCaseReportTextValueNode('Date of Birth', '10-1-1990'),
        generateCaseReportSectionNode('Gender', [
          generateCaseReportTextValueNode('Select Gender', 'female'),
        ]),
        generateCaseReportTextValueNode('Race/Ethnicity', 'white'),
        generateCaseReportTextValueNode('Language', 'English'),
      ]),
      generateCaseReportSectionNode('Safety Plan', [
        generateCaseReportTextValueNode('Write Signs Here', 'warning'),
        generateCaseReportTextValueNode('Write Strategies Here', 'coping'),
        generateCaseReportTextValueNode('Write People or Places Here', 'distractions'),
        generateCaseReportTextValueNode('Write Here', 'who'),
        generateCaseReportTextValueNode('Write Contact(s) Here', 'crisis'),
        generateCaseReportTextValueNode('Write How Here', 'safe'),
      ]),
      generateCaseReportSectionNode('Collaborative SUD Survey', [
        generateCaseReportSectionNode(
          'In the past 3 months, have you used any of the following substances (check all that apply)',
          [
            generateCaseReportCheckboxValueNode('thing1', true),
            generateCaseReportCheckboxValueNode('thing2', true),
            generateCaseReportTextValueNode('Other Substances Used', 'other'),
          ],
        ),
        generateCaseReportTextValueNode(
          'In the past 3 months, have you ever tried and failed to control, cut down, or stop using the substances listed above?',
          'thing1',
        ),
        generateCaseReportTextValueNode(
          'Are you interested in treatment for substance use disorder? If yes, continue with survey.',
          'much',
        ),
        generateCaseReportTextValueNode(
          'There are several options for substance use disorder treatment. Which are you interested in?',
          'many treatments',
        ),
        generateCaseReportTextValueNode('Do you have a pet(s)/service animal(s)?', 'yes'),
        generateCaseReportTextValueNode(
          'What type of pet(s)/service animal(s)?',
          'quasit',
        ),
        generateCaseReportTextValueNode(
          'Is separating from your pet(s)/service animal a barrier to participating in the pilot program?',
          'cannot get rid of it, it follows me everywhere',
        ),
      ]),
      generateCaseReportSectionNode('Next Action', [
        generateCaseReportTextValueNode('Case Status', 'Closed: No-Follow Up'),
      ]),
    ],
  },
  ...patch,
});

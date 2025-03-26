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
import { CaseReport } from '../src/caseReport';

const EMPTY_INCIDENT_REPORT: IncidentReport = {
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

const EMPTY_CASE_REPORT: CaseReport = {
  case_id: undefined as any,
  contact_id: '',
  id: undefined as any,
  issue_report: [],
  narrative: { behaviour: '', intervention: '', plan: '', response: '' },
  primary_disposition: undefined as any,
  updated_at: '',
};

export const generateCaseReport = (
  patch: Partial<CaseReport> & Pick<CaseReport, 'id'>,
): CaseReport => ({
  ...EMPTY_CASE_REPORT,
  ...patch,
});

export const generateCompleteCaseReport = (
  patch: Partial<CaseReport> & Pick<CaseReport, 'id'>,
): CaseReport => ({
  ...EMPTY_CASE_REPORT,
  case_id: '5678',
  issue_report: ['issue1', 'issue2'],
  updated_at: 'Christmas time',
  primary_disposition: '1234',
  secondary_disposition: {
    tangible_resources_provided: ['tangerine'],
    referral_provided: ['referral'],
    service_obtained: ['service', 'obtained'],
    information_provided: ['some', 'information'],
  },
  narrative: {
    behaviour: 'Ill',
    plan: 'Nine',
    intervention: 'Great',
    response: 'Music',
  },
  demographics: {
    first_name: 'Charlotte',
    last_name: 'Ballantyne',
    nickname: 'Charlie',
    date_of_birth: '10-1-1990',
    gender: 'female',
    race_ethnicity: 'white',
    language: 'English',
  },
  safety_plan: {
    warning_signs: 'warning',
    coping_strategies: 'coping',
    distractions: 'distractions',
    who_can_help: 'who',
    crisis_agencies: 'crisis',
    safe_environment: 'safe',
  },
  collaborative_sud_survey: {
    substances_used: ['thing1', 'thing2'],
    other_substances_used: 'other',
    failed_to_control_substances: 'thing1',
    treatment_interest: 'much',
    treatment_preferences: ['many', 'treatments'],
    has_service_animal: 'yes',
    pet_type: ['quasit'],
    pet_separation_barrier: 'cannot get rid of it, it follows me everywhere',
  },
  ...patch,
});

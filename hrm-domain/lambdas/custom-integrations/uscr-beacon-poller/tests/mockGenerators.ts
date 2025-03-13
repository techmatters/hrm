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
  activation_interval: '',
  additional_resources_timestamp: '',
  address: '',
  caller_name: '',
  caller_number: '',
  case_id: undefined as any,
  category_id: 0,
  contact_id: undefined as any,
  created_at: '',
  description: '',
  destination_arrival_timestamp: '',
  en_route_interval: '',
  en_route_timestamp: '',
  id: undefined as any,
  incident_class_id: 0,
  incident_complete_timestamp: '',
  latitude: 0,
  longitude: 0,
  no_clients_transported: 0,
  on_scene_timestamp: '',
  responder_name: '',
  scene_arrival_interval: '',
  status: '',
  total_incident_interval: '',
  transport_destination: '',
  transport_interval: '',
  transport_timestamp: '',
  triage_interval: '',
  updated_at: '',
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

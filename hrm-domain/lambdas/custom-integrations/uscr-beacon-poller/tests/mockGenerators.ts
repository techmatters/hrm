import { IncidentReport } from '../src/incidentReport';

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

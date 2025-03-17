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

import { NewCaseSectionInfo } from './types';

export type IncidentReport = {
  id: number;
  case_id: number;
  contact_id: string;
  description: string;
  address: string;
  category_id: number;
  incident_class_id: number;
  status: string;
  caller_name: string;
  caller_number: string;
  created_at: string;
  updated_at: string;
  latitude: number;
  longitude: number;
  responder_name: string;
  transport_destination: string;
  no_clients_transported: number;
  en_route_timestamp: string;
  on_scene_timestamp: string;
  additional_resources_timestamp: string;
  transport_timestamp: string;
  destination_arrival_timestamp: string;
  incident_complete_timestamp: string;
  activation_interval: string;
  en_route_interval: string;
  scene_arrival_interval: string;
  triage_interval: string;
  transport_interval: string;
  total_incident_interval: string;
};

export const incidentReportToCaseSection = ({
  id,
  case_id,
  updated_at,
  incident_class_id,
  category_id,
  latitude,
  longitude,
  address,
  responder_name,
  transport_destination,
  no_clients_transported,
  en_route_timestamp,
  on_scene_timestamp,
  additional_resources_timestamp,
  transport_timestamp,
  destination_arrival_timestamp,
  incident_complete_timestamp,
  activation_interval,
  en_route_interval,
  scene_arrival_interval,
  triage_interval,
  transport_interval,
  total_incident_interval,
}: IncidentReport): NewCaseSectionInfo => {
  return {
    caseId: case_id.toString(),
    lastUpdated: updated_at,
    section: {
      sectionId: id.toString(),
      sectionTypeSpecificData: {
        operatingArea: incident_class_id,
        incidentType: category_id,
        latitude,
        longitude,
        locationAddress: address,
        responderName: responder_name,
        transportDestination: transport_destination,
        numberOfClientsTransported: no_clients_transported,
        enrouteTimestamp: en_route_timestamp,
        onSceneTimestamp: on_scene_timestamp,
        additionalResourcesTimestamp: additional_resources_timestamp,
        transportTimestamp: transport_timestamp,
        destinationArrivalTimestamp: destination_arrival_timestamp,
        incidentCompleteTimestamp: incident_complete_timestamp,
        incidentActivationInterval: activation_interval,
        enrouteInterval: en_route_interval,
        sceneArrivalInterval: scene_arrival_interval,
        triageInterval: triage_interval,
        transportInterval: transport_interval,
        totalIncidentInterval: total_incident_interval,
      },
    },
  };
};

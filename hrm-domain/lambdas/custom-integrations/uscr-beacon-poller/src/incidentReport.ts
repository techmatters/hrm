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

type Responder = {
  id: number;
  name: string;
  timestamps: {
    alert_reply_received_at: string | null;
    enroute_received_at: string | null;
    on_scene_received_at: string | null;
    additional_reply_received_at: string | null;
    transport_info_received_at: string | null;
    hospital_arrival_received_at: string | null;
    complete_incident_received_at: string | null;
  };
  intervals: {
    enroute_time_interval: number | null;
    scene_arrival_interval: number | null;
    triage_interval: number | null;
    total_scene_interval: number | null;
    transport_interval: number | null;
    total_incident_interval: number | null;
  };
};

export type IncidentReport = {
  id: number;
  case_id: string | null;
  contact_id: string | null;
  description: string;
  address: string;
  category_id: number;
  category: string | null;
  incident_class_id: number;
  status: string;
  caller_name: string;
  caller_number: string;
  created_at: string;
  updated_at: string;
  latitude: number;
  longitude: number;
  transport_destination: string;
  number_of_patient_transports: number;
  responders: Responder[];
  tags: string[];
};

export const incidentReportToCaseSection = ({
  id,
  case_id,
  updated_at,
  incident_class_id,
  category,
  latitude,
  longitude,
  address,
  responders,
  transport_destination,
  number_of_patient_transports,
}: IncidentReport): NewCaseSectionInfo => {
  const firstResponder: Responder | null = responders[0] ?? null;
  const responderSections = firstResponder
    ? {
        responderName: firstResponder.name,
        enrouteTimestamp: firstResponder.timestamps.enroute_received_at,
        onSceneTimestamp: firstResponder.timestamps.on_scene_received_at,
        additionalResourcesTimestamp:
          firstResponder.timestamps.additional_reply_received_at,
        transportTimestamp: firstResponder.timestamps.transport_info_received_at,
        destinationArrivalTimestamp:
          firstResponder.timestamps.hospital_arrival_received_at,
        incidentCompleteTimestamp:
          firstResponder.timestamps.complete_incident_received_at,
        enrouteInterval: firstResponder.intervals.enroute_time_interval,
        sceneArrivalInterval: firstResponder.intervals.scene_arrival_interval,
        triageInterval: firstResponder.intervals.triage_interval,
        transportInterval: firstResponder.intervals.transport_interval,
        totalIncidentInterval: firstResponder.intervals.total_incident_interval,
      }
    : {};
  return {
    caseId: case_id as string,
    lastUpdated: updated_at,
    section: {
      sectionId: id.toString(),
      sectionTypeSpecificData: {
        operatingArea: incident_class_id,
        incidentType: category,
        latitude,
        longitude,
        locationAddress: address,
        numberOfClientsTransported: number_of_patient_transports,
        transportDestination: transport_destination,
        ...responderSections,
      },
    },
  };
};

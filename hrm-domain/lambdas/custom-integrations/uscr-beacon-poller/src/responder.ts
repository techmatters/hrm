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

export type Responder = {
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

export const responderToCaseSection = (
  caseId: string,
  incidentReportId: number,
  { name, timestamps, intervals, id }: Responder,
  lastUpdated: string,
): NewCaseSectionInfo => ({
  caseId,
  lastUpdated,
  section: {
    sectionId: `${incidentReportId}/${id}`,
    sectionTypeSpecificData: {
      responderName: name,
      enrouteTimestamp: timestamps.enroute_received_at,
      onSceneTimestamp: timestamps.on_scene_received_at,
      additionalResourcesTimestamp: timestamps.additional_reply_received_at,
      transportTimestamp: timestamps.transport_info_received_at,
      destinationArrivalTimestamp: timestamps.hospital_arrival_received_at,
      incidentCompleteTimestamp: timestamps.complete_incident_received_at,
      enrouteInterval: intervals.enroute_time_interval,
      sceneArrivalInterval: intervals.scene_arrival_interval,
      triageInterval: intervals.triage_interval,
      transportInterval: intervals.transport_interval,
      totalIncidentTime: intervals.total_incident_interval,
    },
  },
});

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

import { ItemProcessor, NewCaseSectionInfo } from './types';
import {
  addDependentSectionToAseloCase,
  addSectionToAseloCase,
  updateAseloCaseOverview,
} from './caseUpdater';
import { isErr, isOk, newErr } from '@tech-matters/types';
import { Responder, responderToCaseSection } from './responder';

export type IncidentReport = {
  id: number;
  number: number;
  class: string;
  priority: string;
  case_id: string | null;
  contact_id: string | null;
  description: string;
  address: string;
  category_id: number;
  category: string | null;
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
  comment: string | null;
  // Incident intervals
  activation_interval: number | null;
  enroute_time_interval: number | null;
  scene_arrival_interval: number | null;
  triage_interval: number | null;
  total_scene_interval: number | null;
  transport_interval: number | null;
  total_incident_interval: number | null;
};

export const incidentReportToCaseSection = ({
  id,
  number,
  case_id,
  updated_at,
  created_at,
  category,
  latitude,
  longitude,
  address,
  transport_destination,
  number_of_patient_transports,
  activation_interval,
  enroute_time_interval,
  scene_arrival_interval,
  triage_interval,
  transport_interval,
  total_scene_interval,
  total_incident_interval,
  tags,
  comment,
}: IncidentReport): NewCaseSectionInfo => {
  return {
    caseId: case_id as string,
    lastUpdated: updated_at,
    section: {
      sectionId: id.toString(),
      sectionTypeSpecificData: {
        beaconIncidentId: id.toString(),
        incidentNumber: number?.toString(),
        incidentCreationTimestamp: created_at,
        incidentType: category,
        latitude,
        longitude,
        locationAddress: address,
        numberOfClientsTransported: number_of_patient_transports,
        transportDestination: transport_destination,
        incidentActivationInterval: activation_interval,
        enrouteInterval: enroute_time_interval,
        sceneArrivalInterval: scene_arrival_interval,
        triageInterval: triage_interval,
        transportInterval: transport_interval,
        totalSceneInterval: total_scene_interval,
        totalIncidentTime: total_incident_interval,
        tags,
        comments: comment,
      },
    },
  };
};

const addIncidentReportSectionToAseloCase = addSectionToAseloCase(
  'incidentReport',
  incidentReportToCaseSection,
);

export const addIncidentReportSectionsToAseloCase: ItemProcessor<IncidentReport> = async (
  incidentReport: IncidentReport,
  lastSeen: string,
) => {
  const incidentReportResult = await addIncidentReportSectionToAseloCase(
    incidentReport,
    lastSeen,
  );

  if (isOk(incidentReportResult)) {
    const addResponderToAseloCase = addDependentSectionToAseloCase(
      'assignedResponder',
      (responder: Responder) =>
        responderToCaseSection(
          incidentReport.case_id!,
          incidentReport.id,
          responder,
          lastSeen,
        ),
    );
    const responderResults = await Promise.all([
      ...(incidentReport.responders ?? []).map(responder =>
        addResponderToAseloCase(responder),
      ),
    ]);
    const overviewPatchResult = await updateAseloCaseOverview(incidentReport.case_id!, {
      operatingArea: incidentReport.class,
      priority: incidentReport.priority,
    });
    const errors = [...responderResults, overviewPatchResult].filter(result =>
      isErr(result),
    );
    // If every error is 'warn', set the aggregate error as 'warn'. If there are any error level logs or ones where a level isn't specified, assume an error
    const level = errors.find(err => isErr(err) && err.error.level !== 'warn')
      ? 'error'
      : 'warn';
    if (errors.length) {
      return newErr({
        message: 'Failed to add responders from incident report to Aselo case',
        error: {
          type: 'AggregateError',
          level,
          lastUpdated: incidentReportResult.unwrap(),
          errors,
        },
      });
    }
  }

  return incidentReportResult;
};

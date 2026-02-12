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
exports.addIncidentReportSectionsToAseloCase = exports.incidentReportToCaseSection = void 0;
const caseUpdater_1 = require("./caseUpdater");
const types_1 = require("@tech-matters/types");
const responder_1 = require("./responder");
const incidentReportToCaseSection = ({ id, number, case_id, updated_at, created_at, category, latitude, longitude, address, transport_destination, number_of_patient_transports, activation_interval, enroute_time_interval, scene_arrival_interval, triage_interval, transport_interval, total_scene_interval, total_incident_interval, tags, comment, }) => {
    return {
        caseId: case_id,
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
exports.incidentReportToCaseSection = incidentReportToCaseSection;
const addIncidentReportSectionToAseloCase = (0, caseUpdater_1.addSectionToAseloCase)('incidentReport', exports.incidentReportToCaseSection);
const addIncidentReportSectionsToAseloCase = async (incidentReport, lastSeen) => {
    const incidentReportResult = await addIncidentReportSectionToAseloCase(incidentReport, lastSeen);
    if ((0, types_1.isOk)(incidentReportResult)) {
        const addResponderToAseloCase = (0, caseUpdater_1.addDependentSectionToAseloCase)('assignedResponder', (responder) => (0, responder_1.responderToCaseSection)(incidentReport.case_id, incidentReport.id, responder, lastSeen));
        const responderResults = await Promise.all([
            ...(incidentReport.responders ?? []).map(responder => addResponderToAseloCase(responder)),
        ]);
        const overviewPatchResult = await (0, caseUpdater_1.updateAseloCaseOverview)(incidentReport.case_id, {
            operatingArea: incidentReport.class,
            priority: incidentReport.priority,
        });
        const errors = [...responderResults, overviewPatchResult].filter(result => (0, types_1.isErr)(result));
        if (errors.length) {
            return (0, types_1.newErr)({
                message: 'Failed to add responders from incident report to Aselo case',
                error: {
                    type: 'AggregateError',
                    level: 'error',
                    lastUpdated: incidentReportResult.unwrap(),
                    errors,
                },
            });
        }
    }
    return incidentReportResult;
};
exports.addIncidentReportSectionsToAseloCase = addIncidentReportSectionsToAseloCase;

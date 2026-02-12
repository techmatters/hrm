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
exports.responderToCaseSection = void 0;
const responderToCaseSection = (caseId, incidentReportId, { name, timestamps, id }, lastUpdated) => ({
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
        },
    },
});
exports.responderToCaseSection = responderToCaseSection;

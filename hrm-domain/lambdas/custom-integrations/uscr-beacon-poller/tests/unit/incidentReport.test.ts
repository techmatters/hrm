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

import { incidentReportToCaseSection } from '../../src/incidentReport';
import { generateIncidentReport } from '../mockGenerators';

describe('incidentReportToCaseSection', () => {
  test('most beacon incident report properties map to equivalents in the Aselo case section', () => {
    const { section, caseId, lastUpdated } = incidentReportToCaseSection(
      generateIncidentReport({
        case_id: 1234,
        id: 5678,
        incident_class_id: 6,
        category_id: 22,
        latitude: -4.2,
        longitude: 13.37,
        address: 'Echo Park, Los Angeles, CA, USA',
        responder_name: 'Lorna Ballantyne',
        transport_destination: 'Europa, Saturn',
        no_clients_transported: 4000000000,
        en_route_timestamp: '1970',
        on_scene_timestamp: '1974',
        additional_resources_timestamp: '80s',
        transport_timestamp: '1978',
        destination_arrival_timestamp: '2025',
        incident_complete_timestamp: '2026 (est)',
        activation_interval: '6 months',
        en_route_interval: '4 years',
        scene_arrival_interval: '3 weeks',
        triage_interval: '4 years',
        transport_interval: '47 years',
        total_incident_interval: '55 years',
        updated_at: 'not long ago',
      }),
    );
    expect(caseId).toBe('1234');
    expect(lastUpdated).toBe('not long ago');
    expect(section).toStrictEqual({
      sectionId: '5678',
      sectionTypeSpecificData: {
        operatingArea: 6,
        incidentType: 22,
        latitude: -4.2,
        longitude: 13.37,
        locationAddress: 'Echo Park, Los Angeles, CA, USA',
        responderName: 'Lorna Ballantyne',
        transportDestination: 'Europa, Saturn',
        numberOfClientsTransported: 4000000000,
        enrouteTimestamp: '1970',
        onSceneTimestamp: '1974',
        additionalResourcesTimestamp: '80s',
        transportTimestamp: '1978',
        destinationArrivalTimestamp: '2025',
        incidentCompleteTimestamp: '2026 (est)',
        incidentActivationInterval: '6 months',
        enrouteInterval: '4 years',
        sceneArrivalInterval: '3 weeks',
        triageInterval: '4 years',
        transportInterval: '47 years',
        totalIncidentInterval: '55 years',
      },
    });
  });
});

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
import each from 'jest-each';

describe('incidentReportToCaseSection', () => {
  test('most beacon incident report properties map to equivalents in the Aselo case section', () => {
    const { section, caseId, lastUpdated } = incidentReportToCaseSection(
      generateIncidentReport({
        case_id: '1234',
        id: 5678,
        incident_class_id: 6,
        category_id: 22,
        category: 'Planetary Evacuation',
        latitude: -4.2,
        longitude: 13.37,
        address: 'Echo Park, Los Angeles, CA, USA',
        transport_destination: 'Europa, Saturn',
        number_of_patient_transports: 4000000000,
        updated_at: 'not long ago',
        tags: [],
        responders: [
          {
            name: 'Lorna Ballantyne',
            id: 6183,
            timestamps: {
              alert_reply_received_at: '1969',
              enroute_received_at: '1970',
              on_scene_received_at: '1974',
              additional_reply_received_at: '80s',
              transport_info_received_at: '1978',
              hospital_arrival_received_at: '2025',
              complete_incident_received_at: '2026 (est)',
            },
            intervals: {
              enroute_time_interval: 208,
              scene_arrival_interval: 3,
              triage_interval: 208,
              total_scene_interval: 411,
              transport_interval: null,
              total_incident_interval: 55 * 52,
            },
          },
        ],
      }),
    );
    expect(caseId).toBe('1234');
    expect(lastUpdated).toBe('not long ago');
    expect(section).toStrictEqual({
      sectionId: '5678',
      sectionTypeSpecificData: {
        operatingArea: 6,
        incidentType: 'Planetary Evacuation',
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
        enrouteInterval: 208,
        sceneArrivalInterval: 3,
        triageInterval: 208,
        transportInterval: null,
        totalIncidentInterval: 55 * 52,
      },
    });
  });
  each([
    { input: '', output: '' },
    { input: null, output: null },
    { input: undefined, output: undefined },
  ]).test(
    'incident report case_id $input -> returns $output caseId',
    ({ input, output }) => {
      const { section, caseId } = incidentReportToCaseSection(
        generateIncidentReport({
          case_id: input,
          id: 5678,
        }),
      );
      expect(caseId).toBe(output);
      expect(section.sectionId).toBe('5678');
    },
  );
  each([null, undefined]).test('%s incident id throws an error', val => {
    expect(() =>
      incidentReportToCaseSection(
        generateIncidentReport({
          case_id: '1234',
          id: val,
        }),
      ),
    ).toThrow();
  });
  test('Missing incident id throws an error', () => {
    const incidentReport = generateIncidentReport({
      case_id: '1234',
      id: 1,
    });
    delete (incidentReport as any).id;
    expect(() => incidentReportToCaseSection(incidentReport)).toThrow();
  });
});

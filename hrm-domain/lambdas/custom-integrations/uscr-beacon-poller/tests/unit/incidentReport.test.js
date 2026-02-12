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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyUpdateOverviewRequest = void 0;
const incidentReport_1 = require("../../src/incidentReport");
const mockGenerators_1 = require("../mockGenerators");
const jest_each_1 = __importDefault(require("jest-each"));
const verifyAddSectionRequest_1 = require("./verifyAddSectionRequest");
const node_assert_1 = require("node:assert");
const mockFetch = jest.fn();
global.fetch = mockFetch;
const verifyUpdateOverviewRequest = (caseId, expectedPatch) => {
    expect(mockFetch.mock.calls.length).toBeGreaterThan(1);
    const [, ...subsequentCalls] = mockFetch.mock.calls;
    const call = subsequentCalls.find(([url]) => url ===
        `${process.env.INTERNAL_HRM_URL}/internal/v0/accounts/${process.env.ACCOUNT_SID}/cases/${caseId}/overview`);
    if (!call) {
        throw new node_assert_1.AssertionError({
            message: `Expected request to patch overview not found`,
            actual: mockFetch.mock.calls,
        });
    }
    expect(call[1]).toStrictEqual({
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${process.env.STATIC_KEY}`,
        },
        body: expect.any(String),
    });
    let parsedJson = JSON.parse(call[1].body);
    expect(parsedJson).toStrictEqual(expectedPatch);
};
exports.verifyUpdateOverviewRequest = verifyUpdateOverviewRequest;
describe('incidentReportToCaseSection', () => {
    test('most beacon incident report properties map to equivalents in the Aselo case section', () => {
        const { section, caseId, lastUpdated } = (0, incidentReport_1.incidentReportToCaseSection)((0, mockGenerators_1.generateIncidentReport)({
            class: 'Earth',
            priority: 'Existential Threat',
            created_at: '1969',
            case_id: '1234',
            id: 5678,
            number: 8765,
            category_id: 22,
            category: 'Planetary Evacuation',
            latitude: -4.2,
            longitude: 13.37,
            address: 'Echo Park, Los Angeles, CA, USA',
            transport_destination: 'Europa, Saturn',
            number_of_patient_transports: 4000000000,
            updated_at: 'not long ago',
            tags: ['tag1', 'tag2'],
            activation_interval: 1,
            enroute_time_interval: 208,
            scene_arrival_interval: 3,
            triage_interval: 208,
            total_scene_interval: 411,
            transport_interval: null,
            total_incident_interval: 55 * 52,
            comment: 'far out...',
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
                },
            ],
        }));
        expect(caseId).toBe('1234');
        expect(lastUpdated).toBe('not long ago');
        expect(section).toStrictEqual({
            sectionId: '5678',
            sectionTypeSpecificData: {
                beaconIncidentId: '5678',
                incidentNumber: '8765',
                incidentCreationTimestamp: '1969',
                incidentType: 'Planetary Evacuation',
                latitude: -4.2,
                longitude: 13.37,
                locationAddress: 'Echo Park, Los Angeles, CA, USA',
                transportDestination: 'Europa, Saturn',
                numberOfClientsTransported: 4000000000,
                incidentActivationInterval: 1,
                enrouteInterval: 208,
                sceneArrivalInterval: 3,
                triageInterval: 208,
                totalSceneInterval: 411,
                transportInterval: null,
                totalIncidentTime: 55 * 52,
                tags: ['tag1', 'tag2'],
                comments: 'far out...',
            },
        });
    });
    (0, jest_each_1.default)([
        { input: '', output: '' },
        { input: null, output: null },
        { input: undefined, output: undefined },
    ]).test('incident report case_id $input -> returns $output caseId', ({ input, output }) => {
        const { section, caseId } = (0, incidentReport_1.incidentReportToCaseSection)((0, mockGenerators_1.generateIncidentReport)({
            case_id: input,
            id: 5678,
        }));
        expect(caseId).toBe(output);
        expect(section.sectionId).toBe('5678');
    });
    (0, jest_each_1.default)([null, undefined]).test('%s incident id throws an error', val => {
        expect(() => (0, incidentReport_1.incidentReportToCaseSection)((0, mockGenerators_1.generateIncidentReport)({
            case_id: '1234',
            id: val,
        }))).toThrow();
    });
    test('Missing incident id throws an error', () => {
        const incidentReport = (0, mockGenerators_1.generateIncidentReport)({
            case_id: '1234',
            id: 1,
        });
        delete incidentReport.id;
        expect(() => (0, incidentReport_1.incidentReportToCaseSection)(incidentReport)).toThrow();
    });
});
describe('addIncidentReportSectionsToAseloCase', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({}),
        });
    });
    test('Responders specified - adds case section and responders', async () => {
        await (0, incidentReport_1.addIncidentReportSectionsToAseloCase)((0, mockGenerators_1.generateIncidentReport)({
            class: 'Earth',
            priority: 'Existential Threat',
            created_at: '1969',
            case_id: '1234',
            id: 5678,
            number: 8765,
            category_id: 22,
            category: 'Planetary Evacuation',
            latitude: -4.2,
            longitude: 13.37,
            address: 'Echo Park, Los Angeles, CA, USA',
            transport_destination: 'Europa, Saturn',
            number_of_patient_transports: 4000000000,
            updated_at: 'just now',
            tags: ['tag1', 'tag2'],
            comment: 'far out...',
            activation_interval: 1,
            enroute_time_interval: 208,
            scene_arrival_interval: 3,
            triage_interval: 208,
            total_scene_interval: 411,
            transport_interval: null,
            total_incident_interval: 55 * 52,
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
                },
                {
                    name: 'Charlie Ballantyne',
                    id: 6184,
                    timestamps: {
                        alert_reply_received_at: '1969',
                        enroute_received_at: '1970',
                        on_scene_received_at: '1974',
                        additional_reply_received_at: null,
                        transport_info_received_at: null,
                        hospital_arrival_received_at: null,
                        complete_incident_received_at: '1974',
                    },
                },
            ],
        }), 'not long ago');
        (0, verifyAddSectionRequest_1.verifyAddSectionRequest)('1234', 'incidentReport', {
            sectionId: '5678',
            sectionTypeSpecificData: {
                beaconIncidentId: '5678',
                incidentNumber: '8765',
                incidentCreationTimestamp: '1969',
                incidentType: 'Planetary Evacuation',
                latitude: -4.2,
                longitude: 13.37,
                locationAddress: 'Echo Park, Los Angeles, CA, USA',
                transportDestination: 'Europa, Saturn',
                numberOfClientsTransported: 4000000000,
                incidentActivationInterval: 1,
                enrouteInterval: 208,
                sceneArrivalInterval: 3,
                triageInterval: 208,
                totalSceneInterval: 411,
                transportInterval: null,
                totalIncidentTime: 55 * 52,
                tags: ['tag1', 'tag2'],
                comments: 'far out...',
            },
        });
        (0, verifyAddSectionRequest_1.verifyAddSectionRequest)('1234', 'assignedResponder', {
            sectionId: '5678/6183',
            sectionTypeSpecificData: {
                responderName: 'Lorna Ballantyne',
                enrouteTimestamp: '1970',
                onSceneTimestamp: '1974',
                additionalResourcesTimestamp: '80s',
                transportTimestamp: '1978',
                destinationArrivalTimestamp: '2025',
                incidentCompleteTimestamp: '2026 (est)',
            },
        }, false);
        (0, verifyAddSectionRequest_1.verifyAddSectionRequest)('1234', 'assignedResponder', {
            sectionId: '5678/6184',
            sectionTypeSpecificData: {
                responderName: 'Charlie Ballantyne',
                enrouteTimestamp: '1970',
                onSceneTimestamp: '1974',
                additionalResourcesTimestamp: null,
                transportTimestamp: null,
                destinationArrivalTimestamp: null,
                incidentCompleteTimestamp: '1974',
            },
        }, false);
        (0, exports.verifyUpdateOverviewRequest)('1234', {
            operatingArea: 'Earth',
            priority: 'Existential Threat',
        });
    });
    test('No responders - just adds case section and patches overview', async () => {
        await (0, incidentReport_1.addIncidentReportSectionsToAseloCase)((0, mockGenerators_1.generateIncidentReport)({
            created_at: '1969',
            case_id: '1234',
            id: 5678,
            number: 8765,
            priority: 'Existential Threat',
            class: 'Earth',
            category_id: 22,
            category: 'Planetary Evacuation',
            latitude: -4.2,
            longitude: 13.37,
            address: 'Echo Park, Los Angeles, CA, USA',
            transport_destination: 'Europa, Saturn',
            number_of_patient_transports: 4000000000,
            updated_at: 'just now',
            tags: ['tag1', 'tag2'],
            activation_interval: 1,
            enroute_time_interval: 208,
            scene_arrival_interval: 3,
            triage_interval: 208,
            total_scene_interval: 411,
            transport_interval: null,
            total_incident_interval: 55 * 52,
            comment: 'far out...',
        }), 'not long ago');
        (0, verifyAddSectionRequest_1.verifyAddSectionRequest)('1234', 'incidentReport', {
            sectionId: '5678',
            sectionTypeSpecificData: {
                beaconIncidentId: '5678',
                incidentNumber: '8765',
                incidentCreationTimestamp: '1969',
                incidentType: 'Planetary Evacuation',
                latitude: -4.2,
                longitude: 13.37,
                locationAddress: 'Echo Park, Los Angeles, CA, USA',
                transportDestination: 'Europa, Saturn',
                numberOfClientsTransported: 4000000000,
                incidentActivationInterval: 1,
                enrouteInterval: 208,
                sceneArrivalInterval: 3,
                triageInterval: 208,
                transportInterval: null,
                totalSceneInterval: 411,
                totalIncidentTime: 55 * 52,
                tags: ['tag1', 'tag2'],
                comments: 'far out...',
            },
        });
        (0, exports.verifyUpdateOverviewRequest)('1234', {
            operatingArea: 'Earth',
            priority: 'Existential Threat',
        });
    });
});

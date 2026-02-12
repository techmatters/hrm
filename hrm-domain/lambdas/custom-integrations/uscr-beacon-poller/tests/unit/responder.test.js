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
const responder_1 = require("../../src/responder");
const mockFetch = jest.fn();
global.fetch = mockFetch;
describe('responderToCaseSection', () => {
    test('most beacon incident report properties map to equivalents in the Aselo case section', () => {
        const { section, caseId, lastUpdated } = (0, responder_1.responderToCaseSection)('1234', 5678, {
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
        }, 'not long ago');
        expect(caseId).toBe('1234');
        expect(lastUpdated).toBe('not long ago');
        expect(section).toStrictEqual({
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
        });
    });
});

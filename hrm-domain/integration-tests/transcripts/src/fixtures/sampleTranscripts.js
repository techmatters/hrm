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
exports.INPUT_TRANSCRIPT = void 0;
exports.INPUT_TRANSCRIPT = {
    transcript: {
        accountSid: 'AC-integration-test',
        serviceSid: 'IS-integration-test',
        channelSid: 'CH-integration-test',
        messages: [
            {
                sid: 'IM-integration-test-1',
                dateCreated: '2024-01-16T19:00:31.000Z',
                from: 'QMTWGbOmlc4MaSVVg1IgN8yykaxxvjng',
                body: 'Incoming webchat contact from 99.47.119.218',
                index: 0,
                type: 'text',
                media: null,
            },
            {
                sid: 'IM-integration-test-2',
                dateCreated: '2024-01-16T19:00:34.000Z',
                from: 'Bot',
                body: 'Are you calling about yourself? Please answer Yes or No.',
                index: 1,
                type: 'text',
                media: null,
            },
            {
                sid: 'IM-integration-test-3',
                dateCreated: '2024-01-16T19:02:29.000Z',
                from: 'QMTWGbOmlc4MaSVVg1IgN8yykaxxvjng',
                body: 'yes',
                index: 2,
                type: 'text',
                media: null,
            },
            {
                sid: 'IM-integration-test-4',
                dateCreated: '2024-01-16T19:02:29.000Z',
                from: 'Bot',
                body: 'How old are you?',
                index: 3,
                type: 'text',
                media: null,
            },
            {
                sid: 'IM-integration-test-5',
                dateCreated: '2024-01-16T19:02:31.000Z',
                from: 'QMTWGbOmlc4MaSVVg1IgN8yykaxxvjng',
                body: '14',
                index: 4,
                type: 'text',
                media: null,
            },
            {
                sid: 'IM-integration-test-6',
                dateCreated: '2024-01-16T19:02:32.000Z',
                from: 'Bot',
                body: 'What is your gender?',
                index: 5,
                type: 'text',
                media: null,
            },
            {
                sid: 'IM-integration-test-7',
                dateCreated: '2024-01-16T19:02:34.000Z',
                from: 'QMTWGbOmlc4MaSVVg1IgN8yykaxxvjng',
                body: 'f',
                index: 6,
                type: 'text',
                media: null,
            },
            {
                sid: 'IM-integration-test-8',
                dateCreated: '2024-01-16T19:02:35.000Z',
                from: 'Bot',
                body: "We'll transfer you now. Please hold for a counsellor.",
                index: 7,
                type: 'text',
                media: null,
            },
            {
                sid: 'IM-integration-test-6',
                dateCreated: '2024-01-16T19:03:52.000Z',
                from: 'stephenokpala_40techmatters_2Eorg',
                body: 'Hi, this is the counsellor. How can I help you?',
                index: 8,
                type: 'text',
                media: null,
            },
        ],
        participants: {
            Bot: { user: null, role: null },
            QMintegrationtestuser: {
                user: {
                    sid: 'US-integration-test-user',
                    accountSid: 'AC-integration-test',
                    serviceSid: 'IS-integration-test',
                    attributes: '{}',
                    friendlyName: 'Integration Test User',
                    roleSid: 'RL-integration-test-user-role',
                    identity: 'QM-integration-test-user',
                    dateCreated: '2024-01-16T19:00:28.000Z',
                    joinedChannelsCount: 1,
                    links: {},
                    url: 'https://not-used',
                },
                role: { isCounselor: false },
            },
            integration_test_counselor: {
                user: {
                    sid: 'US-integration-test-counselor',
                    accountSid: 'AC-integration-test',
                    serviceSid: 'IS-integration-test',
                    attributes: '{}',
                    friendlyName: 'Integration Test Counselor',
                    roleSid: 'RL-integration-test-counselor-role',
                    identity: 'integration_test_counselor',
                    dateCreated: '2022-05-09T16:31:46.000Z',
                    joinedChannelsCount: 14,
                    links: {},
                    url: 'https://not-used',
                },
                role: { isCounselor: true },
            },
        },
    },
    accountSid: 'ACintegrationtest',
    contactId: 18995,
    taskId: 'WTintegrationtest',
    twilioWorkerId: 'WK-integration-test-counselor',
    serviceSid: 'IS-integration-test',
    channelSid: 'CH-integration-test',
};

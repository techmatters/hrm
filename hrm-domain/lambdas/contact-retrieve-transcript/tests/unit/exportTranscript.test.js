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
const RestException_1 = __importDefault(require("twilio/lib/base/RestException"));
const exportTranscript_1 = require("../../exportTranscript");
const messageList = [
    {
        sid: 1,
        dateCreated: 'blah',
        from: 'bot',
        body: 'What is your name?',
        index: 0,
        type: 'message',
        media: null,
    },
    {
        sid: 2,
        dateCreated: 'blah',
        from: 'child',
        body: 'George',
        index: 1,
        type: 'message',
        media: null,
    },
    {
        sid: 3,
        dateCreated: 'blah',
        from: 'counselor',
        body: 'How are you today?',
        index: 2,
        type: 'message',
        media: null,
    },
];
const childUserData = {
    identity: 'child',
    friendlyName: 'Child',
    roleSid: 'childRoleSid',
};
const counselorUserData = {
    identity: 'counselor',
    friendlyName: 'Counselor',
    roleSid: 'counselorRoleSid',
};
const childRoleData = {
    sid: 'childRoleSid',
    friendlyName: 'guest',
    isCounselor: false,
};
const counselorRoleData = {
    sid: 'counselorRoleSid',
    friendlyName: 'agent',
    isCounselor: true,
};
const membersList = [
    {
        identity: counselorUserData.identity,
        roleSid: counselorUserData.roleSid,
    },
    {
        identity: childUserData.identity,
        roleSid: childUserData.roleSid,
    },
];
jest.mock('@tech-matters/twilio-client', () => {
    const mockClient = {
        chat: {
            v2: {
                services: () => ({
                    channels: {
                        get: (channelSid) => ({
                            messages: {
                                list: () => messageList,
                            },
                            members: {
                                list: () => channelSid === 'channel-without-counselor'
                                    ? membersList.filter(m => m.identity !== counselorUserData.identity)
                                    : membersList,
                            },
                        }),
                    },
                    users: {
                        get: (identity) => {
                            let userData;
                            switch (identity) {
                                case 'child':
                                    userData = childUserData;
                                    break;
                                case 'counselor':
                                    userData = counselorUserData;
                                    break;
                                default:
                                    // UGGGH. The twilio TS definition for RestException is wrong. It doesn't take the constructor override into account.
                                    // @ts-ignore
                                    throw new RestException_1.default({
                                        statusCode: 404,
                                        body: {
                                            code: 20404,
                                            message: `The requested resource /Services/IS43c487114db441beaad322a360117882/Users/${identity} was not found`,
                                            more_info: 'https://www.twilio.com/docs/errors/20404',
                                        },
                                    });
                            }
                            return {
                                fetch: () => Promise.resolve(userData),
                            };
                        },
                    },
                    roles: {
                        get: (roleSid) => {
                            let roleData;
                            switch (roleSid) {
                                case 'childRoleSid':
                                    roleData = childRoleData;
                                    break;
                                case 'counselorRoleSid':
                                    roleData = counselorRoleData;
                                    break;
                                default:
                                    throw new Error("Role doesn't exist");
                            }
                            return {
                                fetch: () => Promise.resolve(roleData),
                            };
                        },
                    },
                }),
            },
        },
    };
    return {
        getClient: jest.fn(() => mockClient),
    };
});
describe('exportTranscript', () => {
    it('transcript should successfully be exported from twilio (counselor still member of channel)', async () => {
        const transcript = await (0, exportTranscript_1.exportTranscript)({
            accountSid: 'AC-accountSid',
            authToken: 'authToken',
            serviceSid: 'serviceSid',
            channelSid: 'channelSid',
        });
        expect(transcript).toEqual({
            accountSid: 'AC-accountSid',
            serviceSid: 'serviceSid',
            channelSid: 'channelSid',
            messages: messageList,
            participants: {
                bot: {
                    role: null,
                    user: null,
                },
                child: {
                    role: { isCounselor: childRoleData.isCounselor },
                    user: childUserData,
                },
                counselor: {
                    role: { isCounselor: counselorRoleData.isCounselor },
                    user: counselorUserData,
                },
            },
        });
    });
    it('transcript should successfully be exported from twilio (counselor is not member of channel)', async () => {
        const transcript = await (0, exportTranscript_1.exportTranscript)({
            accountSid: 'AC-accountSid',
            authToken: 'authToken',
            serviceSid: 'serviceSid',
            channelSid: 'channel-without-counselor',
        });
        expect(transcript).toEqual({
            accountSid: 'AC-accountSid',
            serviceSid: 'serviceSid',
            channelSid: 'channel-without-counselor',
            messages: messageList,
            participants: {
                bot: {
                    role: null,
                    user: null,
                },
                child: {
                    role: { isCounselor: childRoleData.isCounselor },
                    user: childUserData,
                },
                counselor: {
                    role: { isCounselor: counselorRoleData.isCounselor },
                    user: counselorUserData,
                },
            },
        });
    });
});

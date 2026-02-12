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
exports.exportTranscript = void 0;
const twilio_client_1 = require("@tech-matters/twilio-client");
const RestException_1 = __importDefault(require("twilio/lib/base/RestException"));
const GUEST_ROLE_CHANNEL = 'guest';
const getTransformedMessages = async (client, channelSid, serviceSid) => {
    const messages = await client.chat.v2
        .services(serviceSid)
        .channels.get(channelSid)
        .messages.list();
    return messages.map(m => ({
        sid: m.sid,
        dateCreated: m.dateCreated,
        from: m.from,
        body: m.body,
        index: m.index,
        type: m.type,
        media: m.media,
    }));
};
const getUser = async (client, serviceSid, from) => {
    try {
        const user = await client.chat.v2.services(serviceSid).users.get(from).fetch();
        // Full object contains circular references that can't be converted to json in addition to unnecessary data
        return {
            sid: user.sid,
            accountSid: user.accountSid,
            serviceSid: user.serviceSid,
            attributes: user.attributes,
            friendlyName: user.friendlyName,
            roleSid: user.roleSid,
            identity: user.identity,
            dateCreated: user.dateCreated,
            joinedChannelsCount: user.joinedChannelsCount,
            links: user.links,
            url: user.url,
        };
    }
    catch (err) {
        if (err instanceof RestException_1.default && err.code === 20404) {
            return null;
        }
        throw err;
    }
};
const getRole = async (client, serviceSid, user, member) => {
    try {
        // If the user is null, the participant is Bot, system etc (messages sent with API)
        if (!user) {
            return null;
        }
        // If the user exists and member is null, it means the participant is an agent that was removed from the channel upon task completion
        if (!member) {
            return {
                isCounselor: true,
            };
        }
        const channelRole = await client.chat.v2
            .services(serviceSid)
            .roles.get(member.roleSid)
            .fetch();
        const isCounselor = channelRole.friendlyName !== GUEST_ROLE_CHANNEL;
        // Full object contains circular references that can't be converted to json later on
        return {
            isCounselor,
        };
    }
    catch (err) {
        if (err instanceof RestException_1.default && err.code === 20404) {
            return null;
        }
        throw err;
    }
};
const getParticipants = async (client, channelSid, serviceSid, messages) => {
    const froms = [];
    const participants = {};
    messages.forEach(m => {
        if (!froms.includes(m.from)) {
            froms.push(m.from);
        }
    });
    const members = await client.chat.v2
        .services(serviceSid)
        .channels.get(channelSid)
        .members.list();
    const promises = froms.map(async (from) => {
        const user = await getUser(client, serviceSid, from);
        const member = (user && members.find(m => m.identity === user.identity)) || null;
        const role = await getRole(client, serviceSid, user, member);
        participants[from] = {
            user,
            role,
        };
    });
    await Promise.all(promises);
    return participants;
};
const exportTranscript = async ({ accountSid, authToken, channelSid, serviceSid, }) => {
    // eslint-disable-next-line no-console
    console.log(`Trying to export transcript with accountSid ${accountSid}, serviceSid ${serviceSid}, channelSid ${channelSid}`);
    const client = await (0, twilio_client_1.getClient)({ accountSid, authToken });
    const messages = await getTransformedMessages(client, channelSid, serviceSid);
    const participants = await getParticipants(client, channelSid, serviceSid, messages);
    return {
        accountSid,
        serviceSid,
        channelSid,
        messages,
        participants,
    };
};
exports.exportTranscript = exportTranscript;

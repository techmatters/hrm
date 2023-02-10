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

import { getClient } from '@tech-matters/hrm-twilio-client';

import RestException from 'twilio/lib/base/RestException';
// eslint-disable-next-line prettier/prettier
import type { MemberInstance } from 'twilio/lib/rest/chat/v2/service/channel/member';

export type ExportTranscriptParams = {
  accountSid: string;
  authToken: string;
  serviceSid: string;
  channelSid: string;
};

export type ExportTranscriptResult = Awaited<ReturnType<typeof exportTranscript>>;

export type ExportTranscripParticipants = {
  [key: string]: {
    user: Awaited<ReturnType<typeof getUser>>;
    role: Awaited<ReturnType<typeof getRole>>;
  };
};

const GUEST_ROLE_CHANNEL = 'guest';

const getTransformedMessages = async (
  client: ReturnType<typeof getClient>,
  channelSid: string,
  serviceSid: string,
) => {
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

const getUser = async (client: ReturnType<typeof getClient>, serviceSid: string, from: string) => {
  try {
    const user = await client.chat.v2
      .services(serviceSid)
      .users.get(from)
      .fetch();

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
  } catch (err) {
    if (err instanceof RestException && err.code === 20404) {
      return null;
    }
    throw err;
  }
};

const getRole = async (
  client: ReturnType<typeof getClient>,
  serviceSid: string,
  member: MemberInstance | null,
) => {
  try {
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
  } catch (err) {
    if (err instanceof RestException && err.code === 20404) {
      return null;
    }
    throw err;
  }
};

const getParticipants = async (
  client: ReturnType<typeof getClient>,
  channelSid: string,
  serviceSid: string,
  messages: Awaited<ReturnType<typeof getTransformedMessages>>,
) => {
  const froms: Array<string> = [];

  const participants: ExportTranscripParticipants = {};

  messages.forEach(m => {
    if (!froms.includes(m.from)) {
      froms.push(m.from);
    }
  });

  const members = await client.chat.v2
    .services(serviceSid)
    .channels.get(channelSid)
    .members.list();

  const promises = froms.map(async from => {
    const user = await getUser(client, serviceSid, from);
    const member = (user && members.find(m => m.identity === user.identity)) || null;
    const role = user?.roleSid
      ? await getRole(client, serviceSid, member)
      : null;

    participants[from] = {
      user,
      role,
    };
  });

  await Promise.all(promises);

  return participants;
};

export const exportTranscript = async ({
  accountSid,
  authToken,
  channelSid,
  serviceSid,
}: ExportTranscriptParams) => {
  // eslint-disable-next-line no-console
  console.log(
    `Trying to export transcript with accountSid ${accountSid}, serviceSid ${serviceSid}, channelSid ${channelSid}`,
  );

  const client = getClient({ accountSid, authToken });

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

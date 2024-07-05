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

import { getClient, TwilioClient } from '@tech-matters/twilio-client';

import RestException from 'twilio/lib/base/RestException';
import type { MemberInstance } from 'twilio/lib/rest/chat/v2/service/channel/member';
import { HrmAccountId } from '@tech-matters/types';
import { ExportTranscripParticipants, ExportTranscript } from '@tech-matters/hrm-types';

export type ExportTranscriptParams = {
  accountSid: HrmAccountId;
  authToken: string;
  serviceSid: string;
  channelSid: string;
};

export type ExportTranscriptResult = ExportTranscript;

const GUEST_ROLE_CHANNEL = 'guest';

const getTransformedMessages = async (
  client: TwilioClient,
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

const getUser = async (client: TwilioClient, serviceSid: string, from: string) => {
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
  } catch (err) {
    if (err instanceof RestException && err.code === 20404) {
      return null;
    }
    throw err;
  }
};

const getRole = async (
  client: TwilioClient,
  serviceSid: string,
  user: Awaited<ReturnType<typeof getUser>>,
  member: MemberInstance | null,
) => {
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
  } catch (err) {
    if (err instanceof RestException && err.code === 20404) {
      return null;
    }
    throw err;
  }
};

const getParticipants = async (
  client: TwilioClient,
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
    const role = await getRole(client, serviceSid, user, member);

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
}: ExportTranscriptParams): Promise<ExportTranscriptResult> => {
  // eslint-disable-next-line no-console
  console.log(
    `Trying to export transcript with accountSid ${accountSid}, serviceSid ${serviceSid}, channelSid ${channelSid}`,
  );

  const client = await getClient({ accountSid, authToken });

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

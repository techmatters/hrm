import { getClient } from '@tech-matters/hrm-twilio-client';

import RestException from 'twilio/lib/base/RestException';

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

const CHILD_ROLE = 'service user';

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
  roleSid: string,
) => {
  try {
    const role = await client.chat.v2
      .services(serviceSid)
      .roles.get(roleSid)
      .fetch();

    return {
      sid: role.sid,
      accountSid: role.accountSid,
      serviceSid: role.serviceSid,
      friendlyName: role.friendlyName,
      type: role.type,
      permissions: role.permissions,
      dateCreated: role.dateCreated,
      url: role.url,
      isCounselor: role.friendlyName !== CHILD_ROLE,
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

  const promises = froms.map(async from => {
    const user = await getUser(client, serviceSid, from);
    const role = user?.roleSid ? await getRole(client, serviceSid, user.roleSid) : null;

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
  const participants = await getParticipants(client, serviceSid, messages);

  return {
    accountSid,
    serviceSid,
    channelSid,
    messages,
    participants,
  };
};

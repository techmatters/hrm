import { getClient } from 'hrm-twilio-client';

export type ExportTranscriptParams = {
  accountSid: string;
  authToken: string;
  serviceSid: string;
  channelSid: string;
};

export type ExportTranscriptResult = Awaited<ReturnType<typeof exportTranscript>>;

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
  const messages = await client.chat.v2
    .services(serviceSid)
    .channels.get(channelSid)
    .messages.list();

  const transcript = messages.map((m) => ({
    sid: m.sid,
    dateCreated: m.dateCreated,
    from: m.from,
    body: m.body,
    index: m.index,
    type: m.type,
    media: m.media,
  }));

  return transcript;
};

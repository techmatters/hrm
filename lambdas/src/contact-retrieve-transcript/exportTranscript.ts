import { Twilio } from 'twilio';

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

  //TODO: remove dirty hack to test localstack
  if (process.env.hrm_env == 'local') {
    return [
      {
        sid: 1,
        dateCreated: 'blah',
        from: 'person1',
        body: 'hi',
        index: 0,
        type: 'message',
      },
      {
        sid: 2,
        dateCreated: 'blah',
        from: 'person2',
        body: 'hi',
        index: 1,
        type: 'message',
      },
    ];
  }

  const client = new Twilio(accountSid, authToken);
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

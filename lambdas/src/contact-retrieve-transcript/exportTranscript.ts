import { Twilio } from 'twilio';

type ExportTranscriptParams = {
  accountSid: string;
  authToken: string;
  serviceSid: string;
  channelSid: string;
};

export const exportTranscript = async ({
  accountSid,
  authToken,
  serviceSid,
  channelSid,
}: ExportTranscriptParams) => {
  // eslint-disable-next-line no-console
  console.log(
    `Trying to export transcript with accountSid ${accountSid}, serviceSid ${serviceSid}, channelSid ${channelSid}`,
  );
  try {
    const client = new Twilio(accountSid, authToken);
    const messages = await client.chat.v2
      .services(serviceSid)
      .channels.get(channelSid)
      .messages.list();

    const transformed = messages.map((m) => ({
      sid: m.sid,
      dateCreated: m.dateCreated,
      from: m.from,
      body: m.body,
      index: m.index,
      type: m.type,
      media: m.media,
    }));

    return {
      accountSid,
      serviceSid,
      channelSid,
      messages: transformed,
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return Promise.reject(err);
  }
};

import { Twilio } from 'twilio';

export type ExportTranscriptParams = {
  accountSid: string;
  authToken: string;
  serviceSid: string;
  channelSid: string;
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
  try {
    const client = new Twilio(accountSid, authToken);
    const messages = await client.chat.v2
      .services(serviceSid)
      .channels.get(channelSid)
      .messages.list();

    //TODO: define type for this structure.
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
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return Promise.reject(err);
  }
};

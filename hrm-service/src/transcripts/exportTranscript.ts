import twilio from 'twilio';
import fs from 'fs/promises';

export const exportTranscript = async (
  accountSid: string,
  serviceSid: string,
  channelSid: string,
) => {
  console.log(
    `Trying to export transcript with accountSid ${accountSid}, serviceSid ${serviceSid}, channelSid ${channelSid}`,
  );
  try {
    const authTokenKey = `TWILIO_AUTH_TOKEN_${accountSid}`;
    const authToken = process.env[authTokenKey];

    if (!authToken) throw new Error(`Missing authToken for account with sid ${accountSid}`);

    const client = twilio(accountSid, authToken);
    const messages = await client.chat.v2
      .services(serviceSid)
      .channels.get(channelSid)
      .messages.list();

    const transformed = messages.map(m => ({
      sid: m.sid,
      dateCreated: m.dateCreated,
      from: m.from,
      body: m.body,
      index: m.index,
      type: m.type,
      media: m.media,
    }));

    const docName = `transcript-${accountSid}-${channelSid}.json`;

    const record = {
      accountSid,
      serviceSid,
      channelSid,
      messages: transformed,
    };

    await fs.writeFile(docName, JSON.stringify(record, null, 2));
  } catch (err) {
    console.error(err);
    return Promise.reject(err);
  }
};

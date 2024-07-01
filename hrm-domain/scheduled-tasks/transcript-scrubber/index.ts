// eslint-disable-next-line import/no-extraneous-dependencies
import { fetch } from 'undici';
import { getS3Object, putS3Object } from '@tech-matters/s3-client';
import { receiveSqsMessage, sendSqsMessage } from '@tech-matters/sqs-client';

declare global {
  var fetch: typeof import('undici').fetch;
}

const PENDING_TRANSCRIPT_SQS_QUEUE_URL = process.env.PENDING_TRANSCRIPT_SQS_QUEUE_URL;
const COMPLETED_TRANSCRIPT_SQS_QUEUE_URL = process.env.COMPLETED_TRANSCRIPT_SQS_QUEUE_URL;
const LOCAL_PRIVATEAI_URI_ENDPOINT = new URL('http://localhost:8080/v3/process/text');
const LOCAL_PRIVATEAI_HEALTH_ENDPOINT = new URL('http://localhost:8080/healthz');
const MAX_PAI_STARTUP_TIME_MILLIS = 10 * 60 * 1000;
const MAX_PROCESSING_RUN_TIME_MILLIS = 15 * 60 * 1000;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const waitForPrivateAiToBeReady = async () => {
  let isReady = false;
  let timeoutTime = Date.now() + MAX_PAI_STARTUP_TIME_MILLIS;
  while (!isReady) {
    const response = await fetch(LOCAL_PRIVATEAI_HEALTH_ENDPOINT).catch(() => {
      return { ok: false };
    });
    if (response.ok) {
      isReady = true;
    }
    if (Date.now() > timeoutTime) {
      throw new Error('Private AI did not start in time');
    }
    console.log(
      `Waiting for ${Math.round(
        (Date.now() - timeoutTime) / 1000,
      )} more seconds for Private AI to be ready...`,
    );
    await delay(5000);
  }
};

const scrubS3Transcript = async (bucket: string, key: string) => {
  const transcriptS3ObjectText = await getS3Object({
    bucket,
    key,
  });
  const { transcript } = JSON.parse(transcriptS3ObjectText);

  const response = await fetch(LOCAL_PRIVATEAI_URI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: transcript.messages.map(m => m.body) }),
  });
  const responsePayload = await response.json();
  console.log(response.status, JSON.stringify(responsePayload, null, 2));
  const results = responsePayload as { processed_text: string }[];
  const scrubbedKey = key.replace('transcripts', 'scrubbed-transcripts');
  const scrubbedMessages = transcript.messages.map((m, idx) => ({
    ...m,
    body: results[idx].processed_text,
  }));
  const scrubbedTranscriptJson = JSON.stringify(
    { ...transcript, messages: scrubbedMessages },
    null,
    2,
  );
  console.debug('Saving', scrubbedKey, scrubbedTranscriptJson);
  await putS3Object({
    bucket,
    key: scrubbedKey,
    body: scrubbedTranscriptJson,
  });
  return scrubbedKey;
};

const pollQueue = async (): Promise<boolean> => {
  console.log('Polling queue', PENDING_TRANSCRIPT_SQS_QUEUE_URL);
  const messagesPayload = await receiveSqsMessage({
    queueUrl: PENDING_TRANSCRIPT_SQS_QUEUE_URL,
  });
  const [message] = Array.isArray(messagesPayload?.Messages)
    ? messagesPayload?.Messages
    : [];
  if (!message) {
    return false;
  }
  const parsedPendingMessage = JSON.parse(message.Body);
  const { bucket, key } = JSON.parse(message.Body);
  console.log(`Scrubbing transcript: ${key}`);
  const scrubbedKey = await scrubS3Transcript(bucket, key);
  await sendSqsMessage({
    queueUrl: COMPLETED_TRANSCRIPT_SQS_QUEUE_URL,
    message: JSON.stringify({ ...parsedPendingMessage, scrubbedKey }),
  });
  console.log(`Scrubbed transcript: ${key}, scrubbed version at ${scrubbedKey}`);
  return true;
};

export const executeTask = async () => {
  const processingLatestFinishTime = Date.now() + MAX_PROCESSING_RUN_TIME_MILLIS;
  await waitForPrivateAiToBeReady();
  let processedMessages = 0;
  while (await pollQueue()) {
    processedMessages++;
    if (Date.now() > processingLatestFinishTime) {
      console.warn(
        `Could not process all the pending messages in the configured window of ${Math.round(
          MAX_PROCESSING_RUN_TIME_MILLIS / 1000,
        )} seconds. If this occurs frequently you should look at options to increase the throughput of the scrubbing system.`,
      );
      break;
    }
  }
  console.log(`Processed ${processedMessages} messages this run`);
};

executeTask().catch(console.error);

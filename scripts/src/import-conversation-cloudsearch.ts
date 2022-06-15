import crypto from 'crypto';
import {
  CloudSearchDomainClient,
  UploadDocumentsCommand,
} from '@aws-sdk/client-cloudsearch-domain';
import { randomUUID } from 'crypto';
import delay from 'delay';
import { addMilliseconds, differenceInMilliseconds } from 'date-fns';

import { importConversations } from './importer';
import { JsonMessage } from './json-types';
const CONVERSATIONS_DIRECTORY = '../transcripts-poc/convo-json';
const NUMBER_OF_ACCOUNTS = 10;
const ACCOUNTS = [...Array(NUMBER_OF_ACCOUNTS).keys()].map(idx => `AC${idx}`);
const NUMBER_OF_WORKERS = 30;
const WORKERS = [...Array(NUMBER_OF_ACCOUNTS).keys()].map(idx => `WK${idx}`);

const notNumberPattern = /[^0-9+]/;

function generateConversationMetaData() {
  return [
    Math.random()
      .toString()
      .replace(notNumberPattern, ' '),
  ];
}

async function main() {
  const [, , ...args] = process.argv;

  console.log('Parsing arguments.');
  if (args.length !== 1) {
    console.error(
      `Number of conversations not set, assuming entire contents of '${CONVERSATIONS_DIRECTORY}' is to be imported`,
    );
  }
  const maxNumberOfConversations = Number.parseInt(args.pop());
  const cloudSearchClient = new CloudSearchDomainClient({
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
    region: 'us-east-1',
    endpoint:
      'http://search-transcript-poc-yehrjv4n3xooafzbemhahqjdfe.us-east-1.cloudsearch.amazonaws.com',
  });

  const MAX_DOCUMENT_BATCH_BYTES = 1024 * (1024 - 1) * 5; // Upload 1k less than the 5MB limit, just in case that doesn't account for headers etc.
  const MIN_DOCUMENT_UPLOAD_DELAY_MILLISECONDS = 10000;

  let convoBatch = [];
  let nextUpload: Date | undefined;
  let contactId = 1;

  const uploadDocumentBatchAsap = async (batch: unknown[]) => {
    if (nextUpload) {
      const millisecondsToWait = differenceInMilliseconds(nextUpload, new Date());
      console.log(
        `Waiting ${millisecondsToWait}ms to ensure cloudsearch doc uploads are 10 seconds apart`,
      );
      await delay(millisecondsToWait);
    }
    console.log(`Uploading batch of ${batch.length} documents`);
    await cloudSearchClient.send(
      new UploadDocumentsCommand({
        contentType: 'application/json',
        documents: JSON.stringify(batch),
      }),
    );
  };

  async function uploadConversation(conversation: JsonMessage[]): Promise<void> {
    // Have a predictable ID per document to prevent duplicate docs being uploaded for repeated runs
    const taskSid = crypto
      .createHash('md5')
      .update(JSON.stringify(conversation))
      .digest('hex');
    const convo = {
      id: taskSid,
      type: 'add',
      fields: {
        account_sid: ACCOUNTS[Math.trunc(Math.random() * NUMBER_OF_ACCOUNTS)],
        channel_sid: randomUUID(),
        worker_sid: WORKERS[Math.trunc(Math.random() * NUMBER_OF_WORKERS)],
        contact_id: (contactId++).toString(),
        messages: conversation.map(m => m.message),
        metadata: generateConversationMetaData(),
        task_sid: taskSid,
      },
    };
    convoBatch.push(convo);
    const fileByteLength = Buffer.byteLength(JSON.stringify(convoBatch, null, 2), 'utf8');
    console.log(`Batch bytes ${fileByteLength} / ${MAX_DOCUMENT_BATCH_BYTES}`);

    if (fileByteLength > MAX_DOCUMENT_BATCH_BYTES) {
      if (convoBatch.length > 1) {
        await uploadDocumentBatchAsap(convoBatch.slice(0, -1));
        nextUpload = addMilliseconds(new Date(), MIN_DOCUMENT_UPLOAD_DELAY_MILLISECONDS);
      } else {
        console.error(
          `Conversation exceeds maximum supported size of ${MAX_DOCUMENT_BATCH_BYTES} bytes (conversation bytes: ${fileByteLength})`,
        );
      }
      convoBatch = convoBatch.slice(-1);
    }
  }

  await importConversations(CONVERSATIONS_DIRECTORY, uploadConversation, maxNumberOfConversations);

  await uploadDocumentBatchAsap(convoBatch);
}

main().catch(err => {
  throw err;
});

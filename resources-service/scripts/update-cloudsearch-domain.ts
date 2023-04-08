/**
 * This script updates the CloudSearch domain with the latest data from the
 * resources database. It is intended to be run as a one-off script, not
 * as a long-running process.
 *
 * It requires AWS credentials to be set up in the environment, and database
 * credentials to be set up in the environment (specified in ../src/config).
 */

import {
  CloudSearchDomainClient,
  UploadDocumentsCommand,
} from '@aws-sdk/client-cloudsearch-domain';

import {
  ReferrableResource,
  ResourceAttributeNode,
  isReferrableResourceAttribute,
  ReferrableResourceAttribute,
} from '@tech-matters/types';

// eslint-disable-next-line import/no-extraneous-dependencies
import delay from 'delay';
import { addMilliseconds, differenceInMilliseconds, parseISO } from 'date-fns';
import cloudSearchConfig from '../src/config/cloud-search';
import { getUnindexedResources } from '../src/resource/resource-model';

import { AccountSID } from '@tech-matters/twilio-worker-auth';
import * as fs from 'fs/promises';

type ResourcesCloudSearchDocument = {
  id: string;
  type: 'add';
  fields: {
    account_sid: string;
    resource_id: string;
    name: string;
    search_terms_en_1: string[];
    search_terms_en_2: string[];
  };
};

const MAX_DOCUMENT_BATCH_BYTES = 1024 * (1024 - 1) * 5; // Upload 1k less than the 5MB limit, just in case that doesn't account for headers etc.
const MIN_DOCUMENT_UPLOAD_DELAY_MILLISECONDS = 10000;

let docBatch: ResourcesCloudSearchDocument[] = [];
let nextUpload: Date | undefined;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const cloudSearchDomainClient = new CloudSearchDomainClient({
  endpoint: cloudSearchConfig().searchUrl.toString(),
});

/**
 * Dumb algorithm for recursing through a resource's attributes and
 * extracting all the string values into a flat array.
 */
const extractStringsFromResourceAttributes = (
  attributes: ReferrableResource['attributes'],
): string[] => {
  const recurse = (obj: ResourceAttributeNode[keyof ResourceAttributeNode]): string[] => {
    if (Array.isArray(obj)) {
      return obj.flatMap(item => {
        if (isReferrableResourceAttribute(item)) {
          if (
            typeof item.value === 'string' &&
            parseISO(item.value).toString() === 'Invalid Date'
          ) {
            return [item.value];
          }
          return [];
        } else {
          return recurse(item);
        }
      });
    } else {
      return Object.values(obj).flatMap(recurse);
    }
  };
  return Object.values(attributes).flatMap(recurse);
};

const transformResourceToSearchDocument = (
  resource: ReferrableResource,
  accountSid: AccountSID,
): ResourcesCloudSearchDocument => {
  return {
    id: resource.id,
    type: 'add',
    fields: {
      name: `${resource.name} | ${Object.values(
        (resource.attributes.nameDetails ?? {}) as Record<
          string,
          ReferrableResourceAttribute<string>[]
        >,
      )
        .flat()
        // TODO: this was breaking types
        // .filter(rra => rra.language === 'en')
        .map(rra => rra.value)
        .join(' | ')}`,
      search_terms_en_1: extractStringsFromResourceAttributes(resource.attributes),
      search_terms_en_2: [],
      account_sid: accountSid,
      resource_id: resource.id,
    },
  };
};
let batchNo = 0;
const uploadDocumentBatchAsap = async (batch: unknown[]) => {
  if (nextUpload) {
    const millisecondsToWait = differenceInMilliseconds(nextUpload, new Date());
    console.log(
      `Waiting ${millisecondsToWait}ms to ensure cloudsearch doc uploads are 10 seconds apart`,
    );
    await delay(millisecondsToWait);
  }
  console.log(`Uploading batch of ${batch.length} documents`);
  await fs.appendFile(
    `../resource-json/cloudsearch-documents/batch-${batchNo}.json`,
    JSON.stringify(
      new UploadDocumentsCommand({
        contentType: 'application/json',
        documents: JSON.stringify(batch),
      }),
      null,
      2,
    ),
  );

  await cloudSearchDomainClient.send(
    new UploadDocumentsCommand({
      contentType: 'application/json',
      documents: JSON.stringify(batch),
    }),
  );
  batchNo++;
};

async function uploadResource(accountSid: AccountSID, resource: ReferrableResource): Promise<void> {
  const doc = transformResourceToSearchDocument(resource, accountSid);
  console.debug(`Uploading document for resource ${resource.id}`, doc);
  docBatch.push(doc);
  const fileByteLength = Buffer.byteLength(JSON.stringify(docBatch, null, 2), 'utf8');
  console.log(`Batch bytes ${fileByteLength} / ${MAX_DOCUMENT_BATCH_BYTES}`);

  if (fileByteLength > MAX_DOCUMENT_BATCH_BYTES) {
    if (docBatch.length > 1) {
      await uploadDocumentBatchAsap(docBatch.slice(0, -1));
      nextUpload = addMilliseconds(new Date(), MIN_DOCUMENT_UPLOAD_DELAY_MILLISECONDS);
    } else {
      console.error(
        `Resource document exceeds maximum supported size of ${MAX_DOCUMENT_BATCH_BYTES} bytes (document bytes: ${fileByteLength})`,
      );
    }
    docBatch = docBatch.slice(-1);
  }
}

const updateCloudSearchDomain = async () => {
  const dbResources = await getUnindexedResources(10000);
  for (const resource of dbResources) {
    await uploadResource(resource.accountSid, resource);
  }
  // Upload anything in the last batch
  if (docBatch.length > 0) {
    await uploadDocumentBatchAsap(docBatch);
  }
};

updateCloudSearchDomain().catch(console.error);

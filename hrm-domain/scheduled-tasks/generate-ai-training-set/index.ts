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

import { HrmAccountId } from '@tech-matters/types';
import { getSsmParameter } from '@tech-matters/ssm-cache';
import { streamTrainingSetContacts, TrainingSetContact } from './hrmdbAccess';
import { attachTranscript } from './trainingSetDocument';
import { uploadTrainingSetDocument, uploadStreamAsSingleFile } from './uploadTrainingSet';
import { Transform } from 'stream';

type Environment = 'development' | 'staging' | 'production';

const lookupAccountSid = async (
  environment: Environment,
  hlShortCode: string,
): Promise<HrmAccountId> =>
  (await getSsmParameter(
    `/${environment}/twilio/${hlShortCode.toUpperCase()}/account_sid`,
  )) as HrmAccountId;

const lookupAccountSids = async (
  environment: Environment,
  hlShortCodes: string[],
): Promise<{ shortCode: string; accountSid: HrmAccountId }[]> => {
  return Promise.all(
    hlShortCodes.map(async shortCode => {
      return { shortCode, accountSid: await lookupAccountSid(environment, shortCode) };
    }),
  );
};
/**
 * This function will pull the contacts from the database, look up their transcript in s3 and combine them to generate a training set for the AI model
 * It saves the output twice, once as file per contact, once as a single file for each helpline
 * Instead of paginating batches  (which are inefficient in postgres) this uses a streaming approach to ensure that the entire dataset is not loaded into memory
 * The QueryStream object is used to produce a stream of record objects from the database.
 * The Transform object is used to take each record object, attach the transcript to it, serialize it to JSON and upload it to S3
 * The stream of JSON is them passed to an Upload helper object provided by AWS, which handles piping it out to an s3 object
 * The HIGH_WATER_MARK determines how many records can be pushed into memory before waiting for more records to be pushed all the way through the stream pipeline to s3.
 * Just remember that calling a streaming operation like 'pipe' doesn't complete that part of the pipeline for all data, it just sets it up, only when the terminating operation is awaited does the pipeline run, and only when that promise resolves will all the steps of the pipeline be done.
 * @param environment - the environment to run in
 * @param hlShortCodes - the shortcodes of the helplines to generate training sets for
 * @param targetBucket - the bucket to upload the training sets to
 * @param sourceBucket - the bucket to read the transcripts from - this can be used to point it at a different bucket from the one in the database, if this is where scrubbed transcripts have been copied, for example
 * If sourceBucket is set, the transcript key will be prefixed with the helpline short code as it is assumed that the transcripts for all helplines are in the same bucket.
 */
export const generate = async (
  environment: 'development' | 'staging' | 'production',
  hlShortCodes: string[],
  targetBucket: string,
  sourceBucket?: string,
) => {
  const accountSidMappings = await lookupAccountSids(environment, hlShortCodes);
  console.log('Account SIDs found:');
  accountSidMappings.forEach(({ accountSid, shortCode }) => {
    console.log(`Account SID for ${shortCode}: ${accountSid}`);
  });

  for (const { accountSid, shortCode } of accountSidMappings) {
    // Query the DB for contacts and start streaming records with their ID, categories, contact summary and transcript location
    const contactStream = await streamTrainingSetContacts(accountSid);
    console.log(`Streaming contacts for ${shortCode}...`);

    const trainingSetJsonStream = contactStream.pipe(
      new Transform({
        objectMode: true,
        // eslint-disable-next-line @typescript-eslint/no-loop-func
        transform: async function (
          trainingSetContact: TrainingSetContact,
          encoding,
          callback,
        ) {
          let trainingSetDoc;
          try {
            trainingSetDoc = await attachTranscript(
              trainingSetContact,
              shortCode,
              sourceBucket,
            );
          } catch (error) {
            console.info(
              `No transcript found for contact ${trainingSetContact.contactId} in ${shortCode} bucket. Skipping...`,
            );
            callback();
            return;
          }
          await uploadTrainingSetDocument(
            trainingSetDoc.contactId,
            JSON.stringify(trainingSetDoc),
            targetBucket,
            shortCode,
          );

          this.push(trainingSetDoc);
          callback();
        },
      }),
    );

    // Stream all the JSON into a single file. This will ne a set of line separated JSONs, NOT a JSON array
    // This is done to avoid loading the entire dataset into memory
    console.log(`Uploading contacts for ${shortCode}...`);
    await uploadStreamAsSingleFile(trainingSetJsonStream, targetBucket, shortCode);
    console.log(`Streamed contacts for ${shortCode}...`);
  }
};

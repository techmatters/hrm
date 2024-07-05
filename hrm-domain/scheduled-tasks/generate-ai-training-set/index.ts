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
import { streamTrainingSetContacts } from './hrmdbAccess';
import { loadAndAttachTranscripts } from './trainingSetDocument';
import { serializeAndUploadSeparateFiles, uploadSingleFile } from './uploadTrainingSet';

type Environment = 'development' | 'staging' | 'production';

const lookupAccountSid = async (
  environment: Environment,
  hlShortCode: string,
): Promise<HrmAccountId> =>
  (await getSsmParameter(
    `/${environment}/twilio/${hlShortCode}/account-sid`,
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
 */
export const generate = async (
  environment: 'development' | 'staging' | 'production',
  awsRegion: string,
  hlShortCodes: string[],
  targetBucket: string,
  sourceBucket?: string,
) => {
  const accountSidMappings = await lookupAccountSids(environment, hlShortCodes);

  for (const { accountSid, shortCode } of accountSidMappings) {
    // Query the DB for contacts and start streaming records with their ID, categories and transcript location
    const contactStream = await streamTrainingSetContacts(accountSid);
    console.log(`Streaming contacts for ${shortCode}...`);

    // Load the transcript for each record in the stream and attach it to the object in the stream
    const trainingSetDocumentStream = loadAndAttachTranscripts(
      contactStream,
      shortCode,
      sourceBucket,
    );

    // Convert each object to a JSON string and upload it to S3 as a separate file
    const trainingSetJsonStream = serializeAndUploadSeparateFiles(
      trainingSetDocumentStream,
      targetBucket,
      shortCode,
    );

    // Stream all the JSON into a single file. This will ne a set of line separated JSONs, NOT a JSON array
    // This is done to avoid loading the entire dataset into memory
    await uploadSingleFile(trainingSetJsonStream, targetBucket, shortCode);
    console.log(`Streaming contacts for ${shortCode}...`);
  }
};

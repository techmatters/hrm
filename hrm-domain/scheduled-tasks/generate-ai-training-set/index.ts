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
    // Query the DB for contacts and start streaming records with their ID, categories and transcript location
    const contactStream = await streamTrainingSetContacts(accountSid);
    console.log(`Streaming contacts for ${shortCode}...`);

    const trainingSetJsonStream = contactStream.pipe(
      new Transform({
        objectMode: true,
        transform: async function (
          trainingSetContact: TrainingSetContact,
          encoding,
          callback,
        ) {
          const trainingSetDoc = await attachTranscript(
            trainingSetContact,
            shortCode,
            sourceBucket,
          );
          const docJson = JSON.stringify(trainingSetDoc);
          await uploadTrainingSetDocument(
            trainingSetDoc.contactId,
            docJson,
            targetBucket,
            shortCode,
          );
          this.push(`${docJson}\n`);
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

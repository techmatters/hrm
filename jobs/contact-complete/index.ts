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

import { ContactJobProcessorError } from '@tech-matters/hrm-job-errors';

// eslint-disable-next-line prettier/prettier
import type { SQSBatchResponse, SQSEvent, SQSRecord } from 'aws-lambda';

/**
 * I went ahead and created this placeholder for the completed queue processor lambda.
 *
 * It looks like Gian is still working on this in an hrm-services loop, but I don't
 * think it is a big deal to have this in place. I'm happy to remove it if it is too
 * soon.
 * (rbd - 10/10/22)
 */

/**
 * This is based around latest SQS error handling that supports batchItemFailure responses.
 *
 * Reference: https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html#services-sqs-batchfailurereporting
 */

const processRecord = async (sqsRecord: SQSRecord) => {
  try {
    console.dir(sqsRecord);
    // TODO: fill in the actual work!
  } catch (err) {
    console.error(new ContactJobProcessorError('Failed to process record'), err);
  }
};

export const handler = async (event: SQSEvent): Promise<any> => {
  const response: SQSBatchResponse = { batchItemFailures: [] };

  try {
    const promises = event.Records.map(async sqsRecord => processRecord(sqsRecord));

    await Promise.all(promises);

    return response;
  } catch (err) {
    console.error(new ContactJobProcessorError('Failed to init processor'), err);

    // We fail all messages here and rely on SQS retry/DLQ because we hit
    // a fatal error before we could process any of the messages. Once we
    // start using this lambda, we'll need to be sure the internal retry
    // logic is robust enough to handle transient errors.
    response.batchItemFailures = event.Records.map(record => {
      return {
        itemIdentifier: record.messageId,
      };
    });

    return response;
  }
};

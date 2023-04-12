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

import { ResourcesJobProcessorError } from '@tech-matters/hrm-job-errors';
import { indexDocument } from '@tech-matters/elasticsearch-client';

// eslint-disable-next-line prettier/prettier
import type { SQSBatchResponse, SQSEvent, SQSRecord } from 'aws-lambda';

export const handler = async (event: SQSEvent): Promise<any> => {
  const response: SQSBatchResponse = { batchItemFailures: [] };

  const processRecord = async (sqsRecord: SQSRecord) => {
    const message = JSON.parse(sqsRecord.body);

    const { accountSid, document } = message;
    try {
      await indexDocument({
        indexType: 'resources',
        id: document.id,
        document,
        accountSid,
      });
    } catch (err) {
      console.error(new ResourcesJobProcessorError('Failed to process record'), err);

      response.batchItemFailures.push({
        itemIdentifier: sqsRecord.messageId,
      });
    }
  };

  const promises = event.Records.map(async sqsRecord => processRecord(sqsRecord));
  await Promise.all(promises);

  return response;
};

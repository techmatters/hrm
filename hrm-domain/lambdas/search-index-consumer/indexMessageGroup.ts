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

import type { SQSRecord } from 'aws-lambda';

/**
 * Indexes the records and returns the message IDs of the ones that failed
 */
export type IndexRecords = (records: SQSRecord[]) => Promise<string[]>;

/**
 * Indexes the records of one SQS FIFO message group one at a time, so they write to their documents in the order they were sent.
 * Once a record fails, it and the rest of the group are returned as failed without indexing the rest,
 * so SQS redelivers them in their original order.
 */
export const indexMessageGroup =
  (indexRecords: IndexRecords) =>
  async (groupRecords: SQSRecord[]): Promise<string[]> => {
    for (const [position, record] of groupRecords.entries()) {
      const failedMessageIds = await indexRecords([record]);
      if (failedMessageIds.length) {
        return groupRecords.slice(position).map(({ messageId }) => messageId);
      }
    }
    return [];
  };

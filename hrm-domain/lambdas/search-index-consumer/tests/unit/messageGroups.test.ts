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
import { groupRecordsByMessageGroup } from '../../messages';
import { indexMessageGroup } from '../../indexMessageGroup';

const record = (messageId: string, messageGroupId?: string) =>
  ({
    messageId,
    attributes: messageGroupId ? { MessageGroupId: messageGroupId } : {},
  }) as SQSRecord;

const messageIds = (records: SQSRecord[]) => records.map(({ messageId }) => messageId);

describe('groupRecordsByMessageGroup', () => {
  test('groups records by message group, keeping their order in each group', () => {
    const groups = groupRecordsByMessageGroup([
      record('case-1-a', 'case-1'),
      record('case-2-a', 'case-2'),
      record('case-1-b', 'case-1'),
      record('case-1-c', 'case-1'),
    ]);

    expect(groups.map(messageIds)).toStrictEqual([
      ['case-1-a', 'case-1-b', 'case-1-c'],
      ['case-2-a'],
    ]);
  });

  test('puts each record without a message group in a group of its own', () => {
    const groups = groupRecordsByMessageGroup([record('a'), record('b')]);

    expect(groups.map(messageIds)).toStrictEqual([['a'], ['b']]);
  });
});

describe('indexMessageGroup', () => {
  test('indexes the records one at a time, in order', async () => {
    const indexed: string[][] = [];
    let recordsBeingIndexed = 0;
    const indexRecords = async (records: SQSRecord[]) => {
      recordsBeingIndexed += records.length;
      expect(recordsBeingIndexed).toBe(1);
      await new Promise(resolve => setTimeout(resolve, 1));
      indexed.push(messageIds(records));
      recordsBeingIndexed -= records.length;
      return [];
    };

    const failedMessageIds = await indexMessageGroup(indexRecords)([
      record('a', 'group'),
      record('b', 'group'),
      record('c', 'group'),
    ]);

    expect(indexed).toStrictEqual([['a'], ['b'], ['c']]);
    expect(failedMessageIds).toStrictEqual([]);
  });

  test('stops at the first failure and returns it with the rest of the group as failed', async () => {
    const indexRecords = jest.fn(async (records: SQSRecord[]) =>
      messageIds(records).filter(messageId => messageId === 'b'),
    );

    const failedMessageIds = await indexMessageGroup(indexRecords)([
      record('a', 'group'),
      record('b', 'group'),
      record('c', 'group'),
    ]);

    expect(failedMessageIds).toStrictEqual(['b', 'c']);
    expect(indexRecords.mock.calls.map(([records]) => messageIds(records))).toEqual([
      ['a'],
      ['b'],
    ]);
  });
});

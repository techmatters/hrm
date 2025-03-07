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

import type { IndexMessage, DeleteMessage } from '@tech-matters/hrm-search-config';
import type { AccountSID } from '@tech-matters/types';
import type { SQSRecord } from 'aws-lambda';

export type MessageWithMeta = {
  message: IndexMessage | DeleteMessage;
  messageId: string;
};
export type MessagesByAccountSid = Record<AccountSID, MessageWithMeta[]>;

const groupMessagesReducer = (
  accum: MessagesByAccountSid,
  curr: SQSRecord,
): MessagesByAccountSid => {
  const { messageId, body } = curr;
  const deserialized = JSON.parse(body);
  // This is compatibility code, can be removed when HRM v1.26.x is deployed everywhere
  deserialized.entityType = deserialized.entityType || deserialized.type;
  const message = deserialized as IndexMessage;

  const { accountSid } = message;

  if (!accum[accountSid]) {
    return { ...accum, [accountSid]: [{ messageId, message }] };
  }

  return { ...accum, [accountSid]: [...accum[accountSid], { messageId, message }] };
};

export const groupMessagesByAccountSid = (records: SQSRecord[]): MessagesByAccountSid =>
  records.reduce<MessagesByAccountSid>(groupMessagesReducer, {});

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

import {
  sendSqsMessage,
  SendSqsMessageParams,
  sendSqsMessageBatch,
  SendSqsMessageBatchMessage,
} from '@aws-sdk/client-sqs';
import { getStackOutput } from '../cdk/cdkOutput';

export const sendMessage = async ({
  lambdaName,
  message,
  messageGroupId,
}: {
  lambdaName: string;
  message: object;
  messageGroupId?: string;
}) => {
  const lambdaOutput: any = getStackOutput(lambdaName);
  const params: SendSqsMessageParams = {
    message: JSON.stringify(message),
    queueUrl: lambdaOutput.queueUrl,
  };

  // Localstack fifo queues don't really work so don't bother with this for now
  // see https://github.com/localstack/localstack/issues/6766
  if (messageGroupId) {
    params.messageGroupId = messageGroupId;
  }

  return sendSqsMessage(params);
};

export const sendMessageBatch = async ({
  lambdaName,
  messages,
  groupIdProperty,
  groupIdField,
}: {
  lambdaName: string;
  messages: object[];
  groupIdProperty?: string;
  groupIdField?: string;
}) => {
  const lambdaOutput: any = getStackOutput(lambdaName);
  const params = {
    queueUrl: lambdaOutput.queueUrl,
    messages: messages.map((message: Record<string, any>, index) => {
      const param: SendSqsMessageBatchMessage = {
        id: index.toString(), // TODO: may neet to be uuid at some point
        message: JSON.stringify(message),
      };

      // Localstack fifo queues don't really work so don't bother with this for now
      // see https://github.com/localstack/localstack/issues/6766
      if (groupIdProperty && groupIdField) {
        param.messageGroupId = message[groupIdProperty][groupIdField];
      }

      return param;
    }),
  };

  return sendSqsMessageBatch(params);
};

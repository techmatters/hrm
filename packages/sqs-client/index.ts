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
  DeleteMessageCommand,
  PurgeQueueCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  SendMessageBatchCommand,
  SQSClient,
  GetQueueAttributesCommand,
} from '@aws-sdk/client-sqs';

const convertToEndpoint = (endpointUrl: string) => {
  const url: URL = new URL(endpointUrl);
  return {
    url: url,
  };
};

const getSqsConfig = () => {
  if (process.env.SQS_ENDPOINT) {
    return {
      region: 'us-east-1',
      endpoint: convertToEndpoint(process.env.SQS_ENDPOINT),
    };
  }

  if (process.env.LOCAL_SQS_PORT) {
    return {
      region: 'us-east-1',
      endpoint: convertToEndpoint(`http://localhost:${process.env.LOCAL_SQS_PORT}`),
    };
  }

  return {};
};

const sqs = new SQSClient(getSqsConfig());

export type DeleteSqsMessageParams = {
  queueUrl: string;
  receiptHandle: string;
};

export type PurgeSqsQueueParams = {
  queueUrl: string;
};

export type ReceiveSqsMessageParams = {
  queueUrl: string;
  maxNumberOfMessages?: number;
  visibilityTimeout?: number;
  waitTimeSeconds?: number;
};

export type SendSqsMessageParams = {
  queueUrl: string;
  message: string;
  messageGroupId?: string;
};

export type SendSqsMessageBatchMessage = {
  id: string;
  message: string;
  messageGroupId?: string;
};

export type SendSqsMessageBatchParams = {
  queueUrl: string;
  messages: SendSqsMessageBatchMessage[];
};

export const deleteSqsMessage = async (params: DeleteSqsMessageParams) => {
  const { queueUrl: QueueUrl, receiptHandle: ReceiptHandle } = params;
  const command = new DeleteMessageCommand({
    QueueUrl,
    ReceiptHandle,
  });

  return sqs.send(command);
};

export const purgeSqsQueue = async (params: PurgeSqsQueueParams) => {
  const { queueUrl: QueueUrl } = params;
  const command = new PurgeQueueCommand({
    QueueUrl,
  });

  return sqs.send(command);
};

export const receiveSqsMessage = async (params: ReceiveSqsMessageParams) => {
  const {
    queueUrl: QueueUrl,
    maxNumberOfMessages = 1,
    visibilityTimeout = 30,
    waitTimeSeconds = 0,
  } = params;
  const command = new ReceiveMessageCommand({
    QueueUrl,
    MaxNumberOfMessages: maxNumberOfMessages,
    VisibilityTimeout: visibilityTimeout,
    WaitTimeSeconds: waitTimeSeconds,
  });

  return sqs.send(command);
};

export const getQueueAttributes = async (params: {
  queueUrl: string;
  attributes: string[];
}) => {
  const { queueUrl: QueueUrl, attributes: AttributeNames } = params;
  const command = new GetQueueAttributesCommand({
    QueueUrl,
    AttributeNames,
  });

  const output = await sqs.send(command);
  return output.Attributes;
};

export const sendSqsMessage = async (params: SendSqsMessageParams) => {
  const {
    messageGroupId: MessageGroupId,
    queueUrl: QueueUrl,
    message: MessageBody,
  } = params;
  const command = new SendMessageCommand({
    QueueUrl,
    MessageBody,
    MessageGroupId,
  });

  return sqs.send(command);
};

export const sendSqsMessageBatch = async (params: SendSqsMessageBatchParams) => {
  const { queueUrl: QueueUrl, messages } = params;
  const Entries = messages.map(message => {
    const { id: Id, messageGroupId: MessageGroupId, message: MessageBody } = message;
    return {
      MessageBody,
      MessageGroupId,
      Id,
    };
  });
  const command = new SendMessageBatchCommand({
    QueueUrl,
    Entries,
  });

  return sqs.send(command);
};

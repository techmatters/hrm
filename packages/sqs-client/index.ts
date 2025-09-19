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
  ReceiveMessageCommandOutput,
} from '@aws-sdk/client-sqs';
import { deleteS3Object, getS3Object, putS3Object } from '@tech-matters/s3-client';
import { randomUUID } from 'node:crypto';

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

const S3_MESSAGE_CONTENT_LOCATION_KEY = '__s3MessageLocation';

const MAX_MESSAGE_PAYLOAD_BYTES = 262144;

export const retrieveMessageContent = async (
  messagePayload: string,
  messageId?: string,
): Promise<string> => {
  const externalContentMessageStart = `${S3_MESSAGE_CONTENT_LOCATION_KEY}=s3://`;
  console.debug(`Comparing start of message to redirect content
${externalContentMessageStart}
${messagePayload.substring(0, externalContentMessageStart.length)}`);
  if (messagePayload?.startsWith(externalContentMessageStart)) {
    const slashAfterBucketIndex = messagePayload?.indexOf(
      '/',
      externalContentMessageStart.length,
    );
    const bucket = messagePayload?.substring(
      externalContentMessageStart.length,
      slashAfterBucketIndex,
    );
    const key = messagePayload?.substring(slashAfterBucketIndex + 1);
    console.debug(
      `Message ${messageId} content is an external store location, retrieving external content from S3 bucket '${bucket}', key '${key}'`,
    );
    const externalContent = await getS3Object({
      bucket,
      key,
    });
    try {
      await deleteS3Object({
        bucket,
        key,
      });
    } catch (error) {
      console.warn(
        `Failed to clean up large message contents from S3 for message ${messageId}, S3 bucket '${bucket}', key '${key}'`,
        error,
      );
    }
    return externalContent;
  } else {
    console.debug(
      `Message ${messageId} content not an external store location, assuming it is stored inline`,
    );
    return messagePayload;
  }
};

const retrieveReceivedMessagesContents = async (
  response: ReceiveMessageCommandOutput,
): Promise<ReceiveMessageCommandOutput> => {
  if (!response.Messages) {
    console.debug(
      'response Messages collection not set, not checking for externally stored payloads',
    );
    return response;
  }

  const expandedMessages = await Promise.all(
    response.Messages.map(async message => ({
      ...message,
      Body: message.Body
        ? await retrieveMessageContent(message.Body, message.MessageId)
        : message.Body,
    })),
  );

  return {
    ...response,
    Messages: expandedMessages,
  };
};

export const newSqsClient = ({
  largeMessageS3BaseLocation,
}: {
  largeMessageS3BaseLocation?: { bucket: string; key: string };
}) => {
  const sqs = new SQSClient(getSqsConfig());

  /**
   * Determines if the message should be saved externally.
   * i.e. if a bucket location has been specified for saving large messages in this client and the message content is too large to send inline in the SQS payload
   * If it is, this function:
   * - saves the original contents to s3 under the configured location
   * - returns an alternative payload, which is just a pointer to the externally stored message content
   * If it is not, it just returns back the original message content
   *
   * @param originalMessageParams
   * @param queueUrl
   */
  const saveLargeMessageExternally = async <
    T extends SendSqsMessageParams | SendSqsMessageBatchParams['messages'][number],
  >(
    originalMessageParams: T,
    queueUrl: string,
  ): Promise<T> => {
    if (!largeMessageS3BaseLocation) {
      console.debug(
        'largeMessageS3BaseLocation not set, not checking if message payload needs storing externally',
      );
      return originalMessageParams;
    }
    const { message } = originalMessageParams;
    const { bucket, key } = largeMessageS3BaseLocation;
    const payloadBytes = new TextEncoder().encode(message).byteLength;
    if (payloadBytes > MAX_MESSAGE_PAYLOAD_BYTES) {
      const now = new Date();
      const externalContentKey = `${key}/${encodeURIComponent(
        queueUrl,
      )}/${now.getFullYear()}-${
        now.getMonth() + 1
      }-${now.getDate()}-${now.getHours()}_${now.getMinutes()}_${now.getSeconds()}_${now.getMilliseconds()}-${randomUUID()}`;

      console.debug(
        `Message content for ${queueUrl} is ${payloadBytes} more than the ${MAX_MESSAGE_PAYLOAD_BYTES} SQS maximum, storing in s3://${bucket}/${externalContentKey}`,
      );
      await putS3Object({
        bucket,
        key: externalContentKey,
        body: message,
      });
      return {
        ...originalMessageParams,
        message: `${S3_MESSAGE_CONTENT_LOCATION_KEY}=s3://${bucket}/${externalContentKey}`,
      };
    }
    console.debug(
      `Message content for ${queueUrl} is ${payloadBytes} less than the ${MAX_MESSAGE_PAYLOAD_BYTES} SQS maximum, sending inline`,
    );
    return originalMessageParams;
  };

  return {
    deleteSqsMessage: async (params: DeleteSqsMessageParams) => {
      const { queueUrl: QueueUrl, receiptHandle: ReceiptHandle } = params;
      const command = new DeleteMessageCommand({
        QueueUrl,
        ReceiptHandle,
      });

      return sqs.send(command);
    },

    purgeSqsQueue: async (params: PurgeSqsQueueParams) => {
      const { queueUrl: QueueUrl } = params;
      const command = new PurgeQueueCommand({
        QueueUrl,
      });

      return sqs.send(command);
    },

    receiveSqsMessage: async (params: ReceiveSqsMessageParams) => {
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
      console.debug(`[SQS client trace] Receiving messages from URL: ${QueueUrl}`);
      const output = await retrieveReceivedMessagesContents(await sqs.send(command));
      console.debug(
        `[SQS client trace] Received messages from URL: ${QueueUrl}, ${output.Messages?.map(
          m => m.MessageId,
        ).join(', ')}`,
      );
      return output;
    },

    getQueueAttributes: async (params: { queueUrl: string; attributes: string[] }) => {
      const { queueUrl: QueueUrl, attributes: AttributeNames } = params;
      const command = new GetQueueAttributesCommand({
        QueueUrl,
        AttributeNames,
      });

      const output = await sqs.send(command);
      return output.Attributes;
    },

    sendSqsMessage: async (params: SendSqsMessageParams) => {
      const {
        messageGroupId: MessageGroupId,
        queueUrl: QueueUrl,
        message: MessageBody,
      } = await saveLargeMessageExternally(params, params.queueUrl);
      const command = new SendMessageCommand({
        QueueUrl,
        MessageBody,
        MessageGroupId,
      });

      console.debug(
        `[SQS client trace] Sending message to URL: ${QueueUrl}, Group: ${MessageGroupId}`,
      );
      const output = await sqs.send(command);
      console.debug(
        `[SQS client trace] Sent message to URL: ${QueueUrl}, Group: ${MessageGroupId}, MessageId: ${output.MessageId}`,
      );
      return output;
    },

    sendSqsMessageBatch: async (params: SendSqsMessageBatchParams) => {
      const { queueUrl: QueueUrl, messages } = params;
      const Entries = await Promise.all(
        messages.map(async message => {
          const {
            id: Id,
            messageGroupId: MessageGroupId,
            message: MessageBody,
          } = await saveLargeMessageExternally(message, QueueUrl);
          return {
            MessageBody,
            MessageGroupId,
            Id,
          };
        }),
      );
      const command = new SendMessageBatchCommand({
        QueueUrl,
        Entries,
      });

      return sqs.send(command);
    },
  };
};

const defaultSqsClient = newSqsClient({});

export const deleteSqsMessage = defaultSqsClient.deleteSqsMessage;

export const purgeSqsQueue = defaultSqsClient.purgeSqsQueue;

export const receiveSqsMessage = defaultSqsClient.receiveSqsMessage;

export const getQueueAttributes = defaultSqsClient.getQueueAttributes;

export const sendSqsMessage = defaultSqsClient.sendSqsMessage;

// unused at the moment, commented out to shut TS up
// export const sendSqsMessageBatch = defaultSqsClient.sendSqsMessageBatch;

export type SqsClient = ReturnType<typeof newSqsClient>;

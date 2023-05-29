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

import { SQS } from 'aws-sdk';
import { getSsmParameter } from '@tech-matters/ssm-cache';
import { sns } from '@tech-matters/sns-client';

// eslint-disable-next-line prettier/prettier
import { type FlatResource,  type ResourcesSearchIndexPayload, ResourcesJobType } from '@tech-matters/types';

const RETRY_COUNT = 4;

let sqs: SQS;

export const getSqsClient = () => {
  if (!sqs) {
    sqs = new SQS();
  }
  return sqs;
};

const getJobQueueUrl = (accountSid: string, jobType: string) => `/${process.env.NODE_ENV}/resources/${accountSid}/queue-url-${jobType}`;

export type PublishToResourcesJobParams = {
  params: ResourcesSearchIndexPayload;
  retryCount?: number;
  messageGroupId?: string;
};


export const publishToResourcesJob = async ({ params, retryCount = 0, messageGroupId }: PublishToResourcesJobParams): Promise<void> => {
  //TODO: more robust error handling/messaging
  try {
    const QueueUrl = await getSsmParameter(
      getJobQueueUrl(params.accountSid, 'contact'),
      86400000,
    );

    const message: SQS.Types.SendMessageRequest = {
      MessageBody: JSON.stringify(params),
      QueueUrl,
    };

    if (messageGroupId) {
      message.MessageGroupId = messageGroupId;
    }

    await getSqsClient()
      .sendMessage(message)
      .promise();
  } catch (err) {
    if (retryCount < RETRY_COUNT) {
      console.error('Failed to publish to resources job. Retrying...', err);
      await new Promise((resolve) => setTimeout(resolve, 250));
      return publishToResourcesJob({ params, retryCount: retryCount + 1, messageGroupId });
    }

    console.error('Failed to publish to resources job. Giving up.', err);

    sns.publish({
      Message: JSON.stringify(params) + err,
      TopicArn: process.env.SNS_TOPIC_ARN || '',
    });
  }
};

export const publishSearchIndexJob = (accountSid: string, resource: FlatResource) => {
  return publishToResourcesJob({
    params: {
      accountSid,
      jobType: ResourcesJobType.SEARCH_INDEX,
      document: resource,
    },
    messageGroupId: `${accountSid}:${resource.id}`,
  });
};

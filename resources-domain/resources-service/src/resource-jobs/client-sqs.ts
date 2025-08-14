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

// TODO: needs to be converted to aws-sdk-v3
import { SQS } from 'aws-sdk';
import { getSsmParameter } from '@tech-matters/ssm-cache';
import { publishSns } from '@tech-matters/sns-client';

import type { HrmAccountId } from '@tech-matters/types';
import {
  FlatResource,
  ResourcesSearchIndexPayload,
  ResourcesJobType,
} from '@tech-matters/resources-types';

const RETRY_COUNT = 4;

let sqs: SQS;

export const getSqsClient = () => {
  if (!sqs) {
    if (process.env.LOCAL_SQS_PORT) {
      // For testing only
      sqs = new SQS({
        endpoint: `http://localhost:${process.env.LOCAL_SQS_PORT}`,
      });
    } else {
      sqs = new SQS();
    }
  }
  return sqs;
};

// will pick between more URLs as & when we interact with more queues directly from the resources resvice
const getJobQueueUrl = () =>
  `/${process.env.NODE_ENV}/${
    process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION
  }/sqs/jobs/hrm-resources-search/queue-url-index`;

export type PublishToResourcesJobParams = {
  params: ResourcesSearchIndexPayload;
  retryCount?: number;
  messageGroupId?: string;
};

export const publishToResourcesJob = async ({
  params,
  retryCount = 0,
  messageGroupId,
}: PublishToResourcesJobParams): Promise<void> => {
  //TODO: more robust error handling/messaging
  try {
    const QueueUrl = await getSsmParameter(getJobQueueUrl(), 86400000);

    const message: SQS.Types.SendMessageRequest = {
      MessageBody: JSON.stringify(params),
      QueueUrl,
    };

    if (messageGroupId) {
      message.MessageGroupId = messageGroupId;
    }

    await getSqsClient().sendMessage(message).promise();
  } catch (err) {
    if (retryCount < RETRY_COUNT) {
      console.error('Failed to publish to resources job. Retrying...', err);
      await new Promise(resolve => setTimeout(resolve, 250));
      return publishToResourcesJob({
        params,
        retryCount: retryCount + 1,
        messageGroupId,
      });
    }

    console.error('Failed to publish to resources job. Giving up.', err);

    await publishSns({
      message: JSON.stringify(params) + err,
      topicArn: process.env.SNS_TOPIC_ARN || '',
    });

    throw err;
  }
};

export const publishSearchIndexJob = (
  accountSid: HrmAccountId,
  resource: FlatResource,
) => {
  return publishToResourcesJob({
    params: {
      accountSid,
      jobType: ResourcesJobType.SEARCH_INDEX,
      document: resource,
    },
    messageGroupId: `${accountSid}:${resource.id}`,
  });
};

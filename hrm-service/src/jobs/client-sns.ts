/**
 * In this PoC, PublishCommand is used, which will send the messages one by one to que SNS topic.
 * Each message MAY trigger a Lambda execution by it's own, depending on SQS they may be batched.
 * To batch SNS messages we should instead use PublishBatchCommand
 */
import {
  SNSClient,
  PublishCommand,
  PublishInput,
  MessageAttributeValue,
} from '@aws-sdk/client-sns';
import { JobType, ContactJob } from './job-data-access';
import { Contact } from '../contact/contact-data-access';
import { assertExhaustive } from './assertExhaustive';

// https://github.com/aws/aws-sdk-js-v3/issues/3063
declare global {
  interface ReadableStream {}
}

const client = new SNSClient({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  region: process.env.AWS_REGION,
});

type CommonContactJobProperties = {
  jobId: ContactJob['id'];
  accountSid: Contact['accountSid'];
  contactId: Contact['id'];
  taskId: Contact['taskId'];
  twilioWorkerId: Contact['twilioWorkerId'];
};

export type PublishRetrieveContactTranscript = CommonContactJobProperties & {
  jobType: JobType.RETRIEVE_CONTACT_TRANSCRIPT;
  serviceSid: Contact['serviceSid'];
  channelSid: Contact['channelSid'];
  filePath: string; // the file name as we want to save the transctipr in S3
};

export type PublishRetrieveContactRecordingUrl = CommonContactJobProperties & {
  jobType: JobType.RETRIEVE_CONTACT_RECORDING_URL;
};

type PublishToJobsTopicParams =
  | PublishRetrieveContactTranscript
  | PublishRetrieveContactRecordingUrl;

const getJobTypeMessageAttribute = (
  params: PublishRetrieveContactTranscript,
): Record<string, MessageAttributeValue> => ({
  jobType: {
    DataType: 'String',
    StringValue: params.jobType,
  },
});

const paramsToMessagAttributes = (
  params: PublishToJobsTopicParams,
): Record<string, MessageAttributeValue> => {
  switch (params.jobType) {
    case JobType.RETRIEVE_CONTACT_TRANSCRIPT:
      return getJobTypeMessageAttribute(params);
    case JobType.RETRIEVE_CONTACT_RECORDING_URL:
      return {};
    // If there's an unhandled case, below statement will error at compile time
    default:
      assertExhaustive(params);
  }
};

export const publishToJobsTopic = async (params: PublishToJobsTopicParams) => {
  try {
    const messageAttributes = paramsToMessagAttributes(params);

    const command: PublishInput = {
      TopicArn: process.env.JOBS_TOPIC_ARN,
      MessageAttributes: messageAttributes,
      Message: JSON.stringify({
        description: `Pending ${params.jobType} with: contactId ${params.contactId}, accountSid ${params.accountSid}`,
        ...params,
      }),
    };

    const data = await client.send(new PublishCommand(command));
    return data;
  } catch (err) {
    console.error('Error trying to send message to SNS topic', err);
  }
};

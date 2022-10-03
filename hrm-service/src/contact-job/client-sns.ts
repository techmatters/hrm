import { PublishToContactJobsTopicParams } from './contact-job-messages';

export const publishToContactJobsTopic = async (params: PublishToContactJobsTopicParams) => {
  try {
    return params;
  } catch (err) {
    console.error('Error trying to send message to SNS topic', err);
  }
};

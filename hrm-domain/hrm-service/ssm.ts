import { mockSsmParameters } from '@tech-matters/testing';
import { Mockttp } from 'mockttp';

export const mockEntitySnsParameters = async (
  mockttp: Mockttp,
  queueName: string,
  topicName: string,
) => {
  await mockSsmParameters(mockttp, [
    {
      pathPattern: /.*\/queue-url-consumer$/,
      valueGenerator: () => queueName,
    },
    {
      pathPattern: /.*\/notifications-sns-topic-arn$/,
      valueGenerator: () => topicName,
    },
  ]);
};

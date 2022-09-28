// eslint-disable-next-line import/no-extraneous-dependencies
import { SSM, S3, SQS } from 'aws-sdk';
import type { SQSEvent, SNSMessage } from 'aws-lambda';
import { exportTranscript } from './exportTranscript';

// Keep in sync with hrm
type PublishRetrieveContactTranscript = {
  jobType: string;
  jobId: number;
  accountSid: string;
  contactId: number;
  taskId: string;
  twilioWorkerId: string;
  serviceSid: string;
  channelSid: string;
  filePath: string;
};

// Keep in sync with hrm
type RetrieveContactTranscriptCompleted = PublishRetrieveContactTranscript & {
  completionPayload: string;
};

function assertFulfilled<T>(item: PromiseSettledResult<T>): item is PromiseFulfilledResult<T> {
  return item.status === 'fulfilled';
}

function assertRejected<T>(item: PromiseSettledResult<T>): item is PromiseRejectedResult {
  return item.status === 'rejected';
}

const pickRetrieveContactTranscriptCompleted = <T extends PublishRetrieveContactTranscript>(
  m: T,
  uploadResult: S3.ManagedUpload.SendData,
): RetrieveContactTranscriptCompleted => ({
  jobType: m.jobType,
  jobId: m.jobId,
  accountSid: m.accountSid,
  contactId: m.contactId,
  taskId: m.taskId,
  twilioWorkerId: m.twilioWorkerId,
  serviceSid: m.serviceSid,
  channelSid: m.channelSid,
  filePath: m.filePath,
  completionPayload: uploadResult.Location,
});

export const handler = async (event: SQSEvent): Promise<any> => {
  try {
    const snsMessages = event.Records.map<SNSMessage>((record) => JSON.parse(record.body));
    const messages = snsMessages.map<PublishRetrieveContactTranscript>((m) =>
      JSON.parse(m.Message),
    );

    console.log(messages);

    const ssm = new SSM();

    // TODO: factor out into a function
    const withParameters = await Promise.allSettled(
      messages.map(async (m) => {
        try {
          const [authToken, docsBucketName] = (
            await Promise.all(
              ['TWILIO_AUTH_TOKEN', 'S3_DOCS_BUCKET_NAME'].map(async (s) =>
                ssm
                  .getParameter({
                    Name: `${s}_${m.accountSid}`,
                    WithDecryption: true,
                  })
                  .promise(),
              ),
            )
          ).map((param) => param.Parameter?.Value);

          const { accountSid, contactId } = m;

          if (!authToken) {
            return await Promise.reject(
              new Error(
                `authToken is missing while trying to import trnascripts for contactId ${contactId} and accountSid ${accountSid}`,
              ),
            );
          }

          if (!docsBucketName) {
            return await Promise.reject(
              new Error(
                `docsBucketName is missing while trying to import trnascripts for contactId ${contactId} and accountSid ${accountSid}`,
              ),
            );
          }

          return {
            ...m,
            authToken,
            docsBucketName,
          };
        } catch (err) {
          console.log(`Failed getting parameters for accountSid ${m.accountSid}`, err);
          return Promise.reject(err);
        }
      }),
    );

    // TODO: factor out into a function
    const withTranscripts = await Promise.allSettled(
      withParameters.map(async (m) => {
        try {
          if (assertRejected(m)) {
            return await Promise.reject(m.reason);
          }

          const { accountSid, authToken, serviceSid, channelSid } = m.value;

          const transcript = await exportTranscript({
            accountSid,
            authToken,
            serviceSid,
            channelSid,
          });

          return { ...m.value, transcript };
        } catch (err) {
          if (assertFulfilled(m)) {
            console.log(
              `Failed getting transcript for contactId, accountSid ${m.value.accountSid}`,
              err,
            );
          }
          return Promise.reject(err);
        }
      }),
    );

    const s3 = new S3();

    // TODO: factor out into a function
    const withTranscriptUrls = await Promise.allSettled(
      withTranscripts.map(async (m) => {
        if (assertRejected(m)) {
          return Promise.reject(m.reason);
        }

        const {
          transcript,
          docsBucketName,
          accountSid,
          contactId,
          taskId,
          twilioWorkerId,
          serviceSid,
          channelSid,
          filePath,
        } = m.value;

        const uploadResult = await s3
          .upload({
            Bucket: docsBucketName,
            Key: filePath,
            Body: JSON.stringify({
              transcript,
              accountSid,
              contactId,
              taskId,
              twilioWorkerId,
              serviceSid,
              channelSid,
            }),
          })
          .promise();

        const completedJob = pickRetrieveContactTranscriptCompleted(m.value, uploadResult);

        return completedJob;
      }),
    );

    const [completedJobs, failedJobs] = [
      withTranscriptUrls.filter(assertFulfilled).map((m) => m.value),
      withTranscriptUrls.filter(assertRejected),
    ];

    const sqs = new SQS();

    // TODO: factor out into a function
    const results = await Promise.allSettled(
      completedJobs.map((m) =>
        sqs
          .sendMessage({
            MessageBody: JSON.stringify(m),
            // TODO: separate queue url by tier and AWS region (different HRMs will consume different queues)
            QueueUrl: 'https://sqs.us-east-1.amazonaws.com/712893914485/development-completed-jobs',
          })
          .promise(),
      ),
    );

    console.log('results:', results);
    // Do we want to do some processing with the failed jobs?
    console.log('failed jobs:', failedJobs);

    return { statusCode: 200 };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(err),
    };
  }
};

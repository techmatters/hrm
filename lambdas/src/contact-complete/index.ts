// eslint-disable-next-line import/no-extraneous-dependencies
import { SQS } from 'aws-sdk';
import type { SQSBatchResponse, SQSEvent, SQSRecord } from 'aws-lambda';

/**
 * This is based around latest SQS error handling that supports batchItemFailure responses.
 *
 * Reference: https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html#services-sqs-batchfailurereporting
 */

const sqs = new SQS();

const processRecord = async (sqsRecord: SQSRecord) => {
  console.dir(sqsRecord);
  // TODO: fill in the actual work!
};

/**
 * I went ahead and created this placeholder for the completed queue processor lambda.
 *
 * It looks like Gian is still working on this in an hrm-services loop, but I don't
 * think it is a big deal to have this in place. I'm happy to remove it if it is too
 * soon.
 * (rbd - 10/10/22)
 */
export const handler = async (event: SQSEvent): Promise<any> => {
  const response: SQSBatchResponse = { batchItemFailures: [] };

  try {
    const promises = event.Records.map(async (sqsRecord) => processRecord(sqsRecord));

    await Promise.all(promises);

    return response;
  } catch (err) {
    console.dir(err);

    // We use batchItemFailures here because we d
    response.batchItemFailures = event.Records.map((record) => {
      return {
        itemIdentifier: record.messageId,
      };
    });

    return response;
  }
};

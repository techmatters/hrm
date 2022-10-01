import { SSM } from 'aws-sdk';
import { PublishRetrieveContactTranscript } from './types';

const ssm = new SSM();

export const getParameters = async (message: PublishRetrieveContactTranscript) => {
  try {
    const [authToken, docsBucketName] = (
      await Promise.all(
        ['TWILIO_AUTH_TOKEN', 'S3_DOCS_BUCKET_NAME'].map(async (s) =>
          ssm
            .getParameter({
              Name: `${s}_${message.accountSid}`,
              WithDecryption: true,
            })
            .promise(),
        ),
      )
    ).map((param) => param.Parameter?.Value);

    const { accountSid, contactId } = message;

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
      authToken,
      docsBucketName,
    };
  } catch (err) {
    console.log(`Failed getting parameters for accountSid ${message.accountSid}`, err);
    return Promise.reject(err);
  }
};

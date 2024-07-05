import ReadableStream = NodeJS.ReadableStream;
import { Upload } from '@aws-sdk/lib-storage';
import { getNativeS3Client, putS3Object } from '@tech-matters/s3-client';
import { PassThrough, Transform } from 'stream';
import { TrainingSetDocument } from './trainingSetDocument';

const fileTimestamp = (date: Date) =>
  date
    .toISOString()
    .replace(/[:-]/g, '')
    .replace(/[T.].+/, '-');

export const uploadSingleFile = async (
  trainingSetDocumentStream: ReadableStream,
  targetBucket: string,
  helplineCode: string,
) => {
  const upload = new Upload({
    client: getNativeS3Client(),
    params: {
      Bucket: targetBucket,
      Key: `${helplineCode}/categoryTrainingSet_${fileTimestamp(new Date())}.json`,
      Body: trainingSetDocumentStream.pipe(new PassThrough({ objectMode: false })),
    },
  });

  await upload.done();
};

export const serializeAndUploadSeparateFiles = (
  trainingSetDocumentStream: ReadableStream,
  targetBucket: string,
  helplineCode: string,
): ReadableStream =>
  trainingSetDocumentStream.pipe(
    new Transform({
      objectMode: false,
      transform: async function (trainingDoc: TrainingSetDocument, encoding, callback) {
        const docJson = JSON.stringify(trainingDoc);
        await putS3Object({
          bucket: targetBucket,
          key: `${helplineCode}/categoryTrainingSet_${fileTimestamp(
            new Date(),
          )}/contact_${trainingDoc.contactId}.json`,
          body: docJson,
        });
        this.push(`${docJson}\n`);
        callback();
      },
    }),
  );

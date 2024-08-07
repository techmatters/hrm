import { getS3Object } from '@tech-matters/s3-client';
import { retryable } from './retryable';

export const waitForS3Object = retryable(async ({
  bucket,
  key
}: {
  bucket: string;
  key: string;
}): Promise<ReturnType<typeof getS3Object> | undefined> => {
  try {
    return getS3Object({ bucket, key });
  } catch (err) {
    return undefined;
  }
});

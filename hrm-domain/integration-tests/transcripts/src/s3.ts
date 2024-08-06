import { getS3Object } from '@tech-matters/s3-client';

export const waitForS3Object = async ({
  bucket,
  key,
  retryCount = 0,
}: {
  bucket: string;
  key: string;
  retryCount?: number;
}): Promise<ReturnType<typeof getS3Object> | undefined> => {
  let result;
  try {
    result = await getS3Object({ bucket, key });
  } catch (err) {
    if (retryCount < 60) {
      await new Promise(resolve => setTimeout(resolve, 250));
      return waitForS3Object({ bucket, key, retryCount: retryCount + 1 });
    }
  }

  return result;
};

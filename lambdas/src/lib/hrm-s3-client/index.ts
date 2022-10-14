import { S3 } from 'aws-sdk';

/**
 * I extracted this out to a library because there isn't a great way to do overrides
 * for the localstack env globally that I could find. It is a little weird, but
 * drys up the setup a bit.
 *
 * Totally open to other ideas here.
 * (rbd 10-10-22)
 */
const getS3Conf = () => {
  const s3Config: {
    endpoint?: string;
    s3ForcePathStyle?: boolean;
    region?: string;
  } = process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT } : {};

  if (process.env.S3_FORCE_PATH_STYLE) {
    s3Config.s3ForcePathStyle = !!process.env.S3_FORCE_PATH_STYLE;
  }

  if (process.env.S3_REGION) {
    s3Config.region = process.env.S3_REGION;
  }
  return s3Config;
};

export const s3 = new S3(getS3Conf());

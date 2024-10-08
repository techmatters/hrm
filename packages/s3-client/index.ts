/**
 * Copyright (C) 2021-2023 Technology Matters
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see https://www.gnu.org/licenses/.
 */

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ClientConfig,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl as awsGetSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

export type DeleteS3ObjectParams = {
  bucket: string;
  key: string;
};

export type GetS3ObjectParams = {
  bucket: string;
  key: string;
  responseContentType?: string;
};

export type PutS3ObjectParams = {
  bucket: string;
  key: string;
  body: string;
  contentType?: string;
};

export type UploadPartParams = {
  bucket: string;
  key: string;
  body: string;
  uploadId: string;
  partNumber: number;
};

export const GET_SIGNED_URL_METHODS = {
  deleteObject: DeleteObjectCommand,
  getObject: GetObjectCommand,
  putObject: PutObjectCommand,
};

export type GetSignedUrlMethods = keyof typeof GET_SIGNED_URL_METHODS;

export type GetSignedUrlParams = {
  method: GetSignedUrlMethods;
  bucket: string;
  key: string;
  body?: string;
  contentType?: string;
};

const convertToEndpoint = (endpointUrl: string) => {
  const url: URL = new URL(endpointUrl);
  return {
    url: url,
  };
};

const getS3EndpointOverride = () => {
  if (process.env.S3_ENDPOINT) {
    return convertToEndpoint(process.env.S3_ENDPOINT);
  } else if (process.env.LOCAL_S3_PORT) {
    return convertToEndpoint(`http://localhost:${process.env.LOCAL_S3_PORT}`);
  }
};

const getS3Conf = () => {
  const s3Config: S3ClientConfig = {};

  const endpointOverride = getS3EndpointOverride();
  if (endpointOverride) {
    s3Config.endpoint = endpointOverride;
  }

  if (process.env.S3_FORCE_PATH_STYLE) {
    s3Config.forcePathStyle = !!process.env.S3_FORCE_PATH_STYLE;
  }

  if (process.env.S3_REGION) {
    s3Config.region = process.env.S3_REGION;
  }

  console.log(`s3Config: ${JSON.stringify(s3Config)}`);

  return s3Config;
};

const s3Client = new S3Client(getS3Conf());

export const getNativeS3Client = () => s3Client;

/**
 * This is a workaround for localstack.  The localstack s3 service
 * returns a url https://localhost/ when you call getSignedUrl.  This
 * function converts that url to the correct localstack url.
 */
export const convertLocalstackUrl = (url: string) => {
  const endpointOverride = getS3EndpointOverride();
  if (!endpointOverride) return url;

  if ('url' in endpointOverride) {
    const endpointUrl = endpointOverride.url.toString();
    return url.replace(
      'https://localhost/',
      endpointUrl.replace('localstack', 'localhost'),
    );
  }

  return url;
};

export const deleteS3Object = async (params: DeleteS3ObjectParams) => {
  const { bucket: Bucket, key: Key } = params;

  const command = new DeleteObjectCommand({
    Bucket,
    Key,
  });

  return s3Client.send(command);
};

export const getS3Object = async (params: GetS3ObjectParams) => {
  const {
    bucket: Bucket,
    key: Key,
    responseContentType: ResponseContentType = 'application/json',
  } = params;

  const command = new GetObjectCommand({
    Bucket,
    Key,
    ResponseContentType,
  });
  const response = await s3Client.send(command);

  let responseDataChunks: Buffer[] = [];
  const responseBody = response.Body as Readable;

  return new Promise<string>(async (resolve, reject) => {
    try {
      responseBody.once('error', (err: any) => reject(err));
      responseBody.on('data', (chunk: Buffer) => responseDataChunks.push(chunk));
      responseBody.once('end', () =>
        resolve(Buffer.concat(responseDataChunks).toString()),
      );
    } catch (err) {
      // Handle the error or throw
      return reject(err);
    }
  });
};

export const putS3Object = async (params: PutS3ObjectParams) => {
  const {
    bucket: Bucket,
    key: Key,
    body: Body,
    contentType: ContentType = 'application/json',
  } = params;

  const command = new PutObjectCommand({
    Bucket,
    Key,
    Body,
    ContentType,
  });

  return s3Client.send(command);
};

export const getSignedUrl = async (params: GetSignedUrlParams) => {
  let command: any;
  const {
    method,
    bucket: Bucket,
    key: Key,
    body: Body,
    contentType: ContentType = 'application/json',
  } = params;
  switch (method) {
    case 'deleteObject':
      command = new DeleteObjectCommand({
        Bucket,
        Key,
      });
      break;
    case 'getObject':
      command = new GetObjectCommand({
        Bucket,
        Key,
      });
      break;
    case 'putObject':
      command = new PutObjectCommand({
        Bucket,
        Key,
        Body,
        ContentType,
      });
      break;
  }

  const signedUrl = await awsGetSignedUrl(s3Client, command, { expiresIn: 3600 });

  // Dirty hack, around localstack returning https://localhost/ as the url
  return convertLocalstackUrl(signedUrl);
};

export const uploadS3Part = async (params: UploadPartParams) => {
  const {
    bucket: Bucket,
    key: Key,
    body: Body,
    uploadId: UploadId,
    partNumber: PartNumber,
  } = params;

  const command = new UploadPartCommand({
    Bucket,
    Key,
    Body,
    UploadId,
    PartNumber,
  });

  return s3Client.send(command);
};

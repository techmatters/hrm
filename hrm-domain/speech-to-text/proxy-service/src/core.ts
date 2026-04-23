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
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { newOk, newErr } from '@tech-matters/types';
import { getNativeS3Client, GetObjectCommand } from '@tech-matters/s3-client';

const AUDIO_DIR = process.env.AUDIO_DIR ?? '/shared/audio';
const DIARIZATION_DIR = process.env.DIARIZATION_DIR ?? '/shared/diarization';
const LOCAL_PYANNOTE_URI = process.env.LOCAL_PYANNOTE_URI ?? 'http://localhost:8081';
const LOCAL_LIMINA_URI = process.env.LOCAL_LIMINA_URI ?? 'http://localhost:8080';
// const LIMINA_API_KEY = process.env.LIMINA_API_KEY ?? '';

/**
 * Sanitizes a file name by stripping directory components to prevent path traversal.
 * Returns null if the result is empty or invalid.
 */
const sanitizeFileName = (fileName: string): string | null => {
  const safe = path.basename(fileName);
  return safe && safe !== '.' && safe !== '..' ? safe : null;
};

const downloadS3ObjectToFile = async (
  bucket: string,
  key: string,
  destPath: string,
): Promise<void> => {
  const client = getNativeS3Client();
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  const response = await client.send(command);
  if (!(response.Body instanceof Readable)) {
    throw new Error('Unexpected S3 response body type');
  }
  const body = response.Body;
  await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
  await new Promise<void>((resolve, reject) => {
    const writer = fs.createWriteStream(destPath);
    body.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
    body.on('error', reject);
  });
};

export const getS3Object = async ({
  bucket,
  fileName,
}: {
  bucket: string;
  fileName: string;
}) => {
  if (!bucket || !fileName) {
    return newErr({
      message: 'bucket and fileName query parameters are required',
      error: 'InvalidParameter',
    } as const);
  }
  const safeFileName = sanitizeFileName(fileName);
  if (!safeFileName) {
    return newErr({
      message: 'Invalid fileName',
      error: 'InvalidParameter',
    } as const);
  }
  try {
    const destPath = path.join(AUDIO_DIR, safeFileName);
    await downloadS3ObjectToFile(bucket, fileName, destPath);
    return newOk({ data: { path: destPath, status: 'ok' } });
  } catch (err) {
    console.error('Error downloading S3 object:', err);
    return newErr({
      message: 'Error downloading S3 object:',
      error: 'InternalServerError',
    } as const);
  }
};

export const processDiariazationJobs = async ({
  concurrentJobs,
  fileName,
}: {
  fileName: string;
  concurrentJobs: number;
}) => {
  if (!fileName || !concurrentJobs) {
    return newErr({
      error: 'InvalidParameter',
      message: 'fileName and concurrentJobs are required',
    } as const);
  }
  const safeFileName = sanitizeFileName(fileName);
  if (!safeFileName) {
    return newErr({
      error: 'InvalidParameter',
      message: 'fileName and concurrentJobs are required',
    } as const);
  }

  try {
    const jobPromises = Array.from({ length: concurrentJobs }, (_, id) => async () => {
      const startTime = new Date();
      const response = await fetch(`${LOCAL_PYANNOTE_URI}/diarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: safeFileName }),
      });
      const endTime = new Date();
      const responseBody = await response.json();
      const jobResult = {
        id,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        duration: endTime.getTime() - startTime.getTime(),
        response: responseBody,
      };
      return jobResult;
    });

    const results = await Promise.all(jobPromises.map(fn => fn()));

    const output = { fileName: safeFileName, jobs: results };
    await fs.promises.mkdir(DIARIZATION_DIR, { recursive: true });
    const outputPath = path.join(DIARIZATION_DIR, `${safeFileName}.json`);
    await fs.promises.writeFile(outputPath, JSON.stringify(output, null, 2));

    return newOk({ data: output });
  } catch (err) {
    console.error('Error running diarization jobs:', err);
    return newErr({
      error: 'InternalServerError',
      message: 'Error running diarization jobs',
    });
  }
};

export const processTranscriptionJobs = async ({
  concurrentJobs,
  fileName,
}: {
  fileName: string;
  concurrentJobs: number;
}) => {
  if (!fileName || concurrentJobs === undefined) {
    return newErr({
      error: 'InvalidParameter',
      message: 'fileName and concurrentJobs are required',
    } as const);
  }
  const safeFileName = sanitizeFileName(fileName);
  if (!safeFileName) {
    return newErr({
      error: 'InvalidParameter',
      message: 'Invalid fileName',
    } as const);
  }
  try {
    const filePath = path.join(AUDIO_DIR, safeFileName);
    const fileBuffer = await fs.promises.readFile(filePath);
    const fileBase64 = fileBuffer.toString('base64');

    const jobPromises = Array.from({ length: concurrentJobs }, (_, id) => async () => {
      const startTime = new Date();
      const response = await fetch(`${LOCAL_LIMINA_URI}/process/files/base64`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // 'x-api-key': LIMINA_API_KEY,
        },
        body: JSON.stringify({ file: fileBase64, fileName: safeFileName }),
      });
      const endTime = new Date();
      const responseBody = await response.json();

      const jobResult = {
        id,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        duration: endTime.getTime() - startTime.getTime(),
        response: responseBody,
      };
      return jobResult;
    });

    const results = await Promise.all(jobPromises.map(fn => fn()));

    const output = { fileName: safeFileName, jobs: results };
    await fs.promises.mkdir(DIARIZATION_DIR, { recursive: true });
    const outputPath = path.join(DIARIZATION_DIR, `${safeFileName}.json`);
    await fs.promises.writeFile(outputPath, JSON.stringify(output, null, 2));

    return newOk({ data: output });
  } catch (err) {
    console.error('Error running limina jobs:', err);
    return newErr({ error: 'InternalServerError', message: 'Error running limina jobs' });
  }
};

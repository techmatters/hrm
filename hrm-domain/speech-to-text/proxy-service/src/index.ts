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

import express from 'express';
import fs from 'fs';
import path from 'path';
import { GetObjectCommand, S3Client, S3ClientConfig } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

const app = express();
const PORT = 3000;

const AUDIO_DIR = process.env.AUDIO_DIR ?? '/shared/audio';
const DIARIZATION_DIR = process.env.DIARIZATION_DIR ?? '/shared/diarization';
const LOCAL_PYANNOTE_URI = process.env.LOCAL_PYANNOTE_URI ?? 'http://localhost:8081';
const LOCAL_LIMINA_URI = process.env.LOCAL_LIMINA_URI ?? 'http://localhost:8080';
const LIMINA_API_KEY = process.env.LIMINA_API_KEY ?? '';

app.use(express.json());

const getS3Client = (): S3Client => {
  const config: S3ClientConfig = {};
  if (process.env.S3_ENDPOINT) {
    config.endpoint = process.env.S3_ENDPOINT;
    config.forcePathStyle = true;
  }
  if (process.env.S3_REGION) {
    config.region = process.env.S3_REGION;
  }
  return new S3Client(config);
};

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
  const client = getS3Client();
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

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/proxy/get-s3-object', async (req, res) => {
  const { bucket, fileName } = req.query as { bucket?: string; fileName?: string };
  if (!bucket || !fileName) {
    res.status(400).json({ error: 'bucket and fileName query parameters are required' });
    return;
  }
  const safeFileName = sanitizeFileName(fileName);
  if (!safeFileName) {
    res.status(400).json({ error: 'Invalid fileName' });
    return;
  }
  try {
    const destPath = path.join(AUDIO_DIR, safeFileName);
    await downloadS3ObjectToFile(bucket, fileName, destPath);
    res.json({ status: 'ok', path: destPath });
  } catch (err) {
    console.error('Error downloading S3 object:', err);
    res.status(500).json({ error: String(err) });
  }
});

app.post('/proxy/diarization-jobs', async (req, res) => {
  const { fileName, concurrentJobs } = req.body as {
    fileName?: string;
    concurrentJobs?: number;
  };
  if (!fileName || concurrentJobs === undefined) {
    res.status(400).json({ error: 'fileName and concurrentJobs are required' });
    return;
  }
  const safeFileName = sanitizeFileName(fileName);
  if (!safeFileName) {
    res.status(400).json({ error: 'Invalid fileName' });
    return;
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
      return {
        id,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        duration: endTime.getTime() - startTime.getTime(),
        response: responseBody,
      };
    });

    const results = await Promise.all(jobPromises.map(fn => fn()));

    const output = { fileName: safeFileName, jobs: results };
    await fs.promises.mkdir(DIARIZATION_DIR, { recursive: true });
    const outputPath = path.join(DIARIZATION_DIR, `${safeFileName}.json`);
    await fs.promises.writeFile(outputPath, JSON.stringify(output, null, 2));

    res.json(output);
  } catch (err) {
    console.error('Error running diarization jobs:', err);
    res.status(500).json({ error: String(err) });
  }
});

app.post('/proxy/limina-jobs', async (req, res) => {
  const { fileName, concurrentJobs } = req.body as {
    fileName?: string;
    concurrentJobs?: number;
  };
  if (!fileName || concurrentJobs === undefined) {
    res.status(400).json({ error: 'fileName and concurrentJobs are required' });
    return;
  }
  const safeFileName = sanitizeFileName(fileName);
  if (!safeFileName) {
    res.status(400).json({ error: 'Invalid fileName' });
    return;
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
          'x-api-key': LIMINA_API_KEY,
        },
        body: JSON.stringify({ file: fileBase64, fileName: safeFileName }),
      });
      const endTime = new Date();
      const responseBody = await response.json();
      return {
        id,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        duration: endTime.getTime() - startTime.getTime(),
        response: responseBody,
      };
    });

    const results = await Promise.all(jobPromises.map(fn => fn()));

    const output = { fileName: safeFileName, jobs: results };
    await fs.promises.mkdir(DIARIZATION_DIR, { recursive: true });
    const outputPath = path.join(DIARIZATION_DIR, `${safeFileName}.json`);
    await fs.promises.writeFile(outputPath, JSON.stringify(output, null, 2));

    res.json(output);
  } catch (err) {
    console.error('Error running limina jobs:', err);
    res.status(500).json({ error: String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`proxy-service listening on port ${PORT}`);
});

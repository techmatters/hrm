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
import { mapHTTPError, isErr } from '@tech-matters/types';
import { getS3Object, processDiariazationJobs, processTranscriptionJobs } from './core';

const app = express();
const PORT = 3000;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/proxy/get-s3-object', async (req, res) => {
  const { bucket, fileName } = req.query as { bucket?: string; fileName?: string };
  const result = await getS3Object({ fileName, bucket });
  if (isErr(result)) {
    const status = mapHTTPError(result, {
      InvalidParameter: 400,
      InternalServerError: 500,
    });
    res.status(status.statusCode).json({});
    return;
  }

  res.status(200).json(result.data);
});

app.post('/diarization-jobs', async (req, res) => {
  const { fileName, concurrentJobs } = req.body as {
    fileName?: string;
    concurrentJobs?: number;
  };
  const result = await processDiariazationJobs({ fileName, concurrentJobs });
  if (isErr(result)) {
    const status = mapHTTPError(result, {
      InvalidParameter: 400,
      InternalServerError: 500,
    });
    res.status(status.statusCode).json({});
    return;
  }

  res.status(200).json(result.data);
});

app.post('/transcription-jobs', async (req, res) => {
  const { fileName, concurrentJobs } = req.body as {
    fileName?: string;
    concurrentJobs?: number;
  };
  const result = await processTranscriptionJobs({ fileName, concurrentJobs });
  if (isErr(result)) {
    const status = mapHTTPError(result, {
      InvalidParameter: 400,
      InternalServerError: 500,
    });
    res.status(status.statusCode).json({});
    return;
  }

  res.status(200).json(result.data);
});

app.listen(PORT, () => {
  console.log(`proxy-service listening on port ${PORT}`);
});

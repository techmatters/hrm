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

import type { ImportProgress } from '@tech-matters/resources-types';
import parseISO from 'date-fns/parseISO';
import type { Config } from './config';
import { isHttpError, nextTimeSequence } from './clients';

export type ProgressSettings = {
  from: string;
  to: string;
  maxBatchSize: number;
  maxRequests: number;
};

export const sequenceImportProgress = async (
  config: Config,
): Promise<ProgressSettings> => {
  if (!config.internalResourcesBaseUrl) {
    throw new Error('Missing internal resources base URL');
  }
  const response = await fetch(
    new URL(
      `/v0/accounts/${config.accountSid}/resources/import/progress`,
      config.internalResourcesBaseUrl,
    ),
    {
      method: 'GET',
      headers: { Authorization: `Basic ${config.internalResourcesApiKey}` },
    },
  );
  const progress:
    | ImportProgress
    | undefined
    | { status: number; statusText: string; body: string } = response.ok
    ? ((await response.json()) as ImportProgress)
    : response.status === 404
    ? undefined
    : {
        status: response.status,
        statusText: response.statusText,
        body: await response.text(),
      };
  if (isHttpError(progress)) {
    throw new Error(
      `Failed to retrieve import progress: ${progress.status} (${progress.statusText}). Response body: ${progress.body}`,
    );
  }
  const from = progress
    ? nextTimeSequence(
        progress.importSequenceId ??
          `${parseISO(progress.lastProcessedDate).valueOf()}-0`,
      )
    : '0-0';
  console.info(
    `Starting import from: ${from} (${progress ? 'resuming' : 'initial'}${
      progress?.importSequenceId ? 'import sequence supplied.' : ''
    })`,
  );
  return {
    from,
    to: `${Date.now()}-0`,
    maxBatchSize: config.maxBatchSize,
    maxRequests: config.maxRequests,
  };
};

export const fullImportProgress = async (): Promise<ProgressSettings> => ({
  from: '',
  to: '',
  maxBatchSize: Number.MAX_SAFE_INTEGER,
  maxRequests: 1,
});

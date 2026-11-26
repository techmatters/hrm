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

import { newOkFromData } from '@tech-matters/types';
import type { TimeSequence } from '@tech-matters/resources-types';
import path from 'path';
import type { Config } from '../config';
import { httpError, nextTimeSequence, PullUpdates, withClientErrors } from './shared';

export type KhpApiResource = {
  _id: string;
  updatedAt: string;
  name: { en: string } & Record<string, string>;
} & Record<string, any>;

export type KhpApiResponse = {
  data: KhpApiResource[];
  totalResults: number;
  nextFrom?: TimeSequence;
};

export const createKhpClient = (config: Config): PullUpdates =>
  withClientErrors(async (from, to, remaining) => {
    const fetchUrl = new URL(
      path.join(
        config.importApiBaseUrl.pathname,
        `api/resources?startSequence=${from}&endSequence=${to}&limit=${Math.min(
          remaining,
          config.maxApiSize,
        )}`,
      ),
      config.importApiBaseUrl,
    );
    const response = await fetch(fetchUrl, {
      headers: {
        Authorization: config.importApiAuthHeader,
        'x-api-key': config.importApiKey,
      },
      method: 'GET',
      signal: AbortSignal.timeout(15 * 60 * 1000),
    });
    if (!response.ok) return httpError(response);

    const { data, totalResults } = (await response.json()) as KhpApiResponse;
    console.info(
      `[GET ${fetchUrl}] Retrieved ${data.length} resources of ${totalResults} from ${from} to ${to}.`,
    );
    return newOkFromData({
      data,
      totalResults,
      ...(data.length && data.length < totalResults
        ? {
            nextFrom: nextTimeSequence(
              data[data.length - 1].timeSequence as TimeSequence,
            ),
          }
        : {}),
    });
  });

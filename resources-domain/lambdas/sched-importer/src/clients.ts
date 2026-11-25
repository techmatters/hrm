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

import type { TimeSequence } from '@tech-matters/resources-types';
import path from 'path';
import type { Config } from './config';

export type HttpError<T = any> = {
  status: number;
  statusText: string;
  body: T;
};

export const isHttpError = <T>(value: any): value is HttpError<T> =>
  typeof value?.status === 'number' &&
  typeof value?.statusText === 'string' &&
  typeof value?.body !== 'undefined';

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

export type NativeResource = Record<string, any>;
export type ApiResponse = {
  data: NativeResource[];
  totalResults: number;
  nextFrom?: TimeSequence;
};
export type PullUpdates = (
  from: string,
  to: string,
  remaining: number,
) => Promise<ApiResponse | HttpError>;

export const nextTimeSequence = (timeSequence: TimeSequence): TimeSequence => {
  const [timestamp, sequence] = timeSequence.split('-');
  return `${Number(timestamp)}-${Number(sequence) + 1}`;
};

const httpError = async (response: Response): Promise<HttpError> => ({
  status: response.status,
  statusText: response.statusText,
  body: await response.text(),
});

export const createKhpClient =
  (config: Config): PullUpdates =>
  async (from, to, remaining) => {
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
    return {
      data,
      totalResults,
      ...(data.length && data.length < totalResults
        ? {
            nextFrom: nextTimeSequence(
              data[data.length - 1].timeSequence as TimeSequence,
            ),
          }
        : {}),
    };
  };

export const createNamiClient =
  (config: Config): PullUpdates =>
  async () => {
    if (config.importApiBaseUrl.protocol !== 'https:') {
      throw new Error('Import API must use HTTPS');
    }
    const termsUrl = new URL(
      path.join(config.importApiBaseUrl.pathname, 'wp-json/wp/v2/aselo'),
      config.importApiBaseUrl,
    );
    termsUrl.searchParams.set('all', 'true');
    const termsResponse = await fetch(termsUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(15 * 60 * 1000),
    });
    if (!termsResponse.ok) return httpError(termsResponse);
    const terms = await termsResponse.json();
    if (
      !Array.isArray(terms) ||
      terms.some(
        term => typeof term?.slug !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(term.slug),
      )
    ) {
      throw new Error('Invalid terms response from import API');
    }
    if (!terms.length) return { data: [], totalResults: 0 };

    const resourcesUrl = new URL(
      path.join(
        config.importApiBaseUrl.pathname,
        'wp-json/nami-resource-finder/v1/resources',
      ),
      config.importApiBaseUrl,
    );
    resourcesUrl.searchParams.set('aselo', terms.map(term => term.slug).join(','));
    resourcesUrl.searchParams.set('all', 'true');
    const resourcesResponse = await fetch(resourcesUrl, {
      method: 'GET',
      headers: { Authorization: config.importApiAuthHeader },
      signal: AbortSignal.timeout(15 * 60 * 1000),
    });
    if (!resourcesResponse.ok) return httpError(resourcesResponse);
    const result = (await resourcesResponse.json()) as {
      resources?: NativeResource[];
      deleted?: NativeResource[];
    };
    if (
      !Array.isArray(result?.resources) ||
      !Array.isArray(result?.deleted) ||
      result.resources.some(
        resource =>
          !Number.isInteger(resource?.id) ||
          typeof resource.name !== 'string' ||
          !resource.name,
      ) ||
      result.deleted.some(
        resource =>
          !Number.isInteger(resource?.id) ||
          typeof resource.deleted_at !== 'string' ||
          !Number.isFinite(Date.parse(resource.deleted_at)),
      )
    ) {
      throw new Error('Invalid resources response from import API');
    }
    const data = [...result.deleted, ...result.resources];
    return { data, totalResults: data.length };
  };

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

import { newErr, newOkFromData } from '@tech-matters/types';
import path from 'path';
import type { Config } from '../config';
import { httpError, NativeResource, PullUpdates, withClientErrors } from './shared';

export const createNamiClient = (config: Config): PullUpdates =>
  withClientErrors(async () => {
    if (config.importApiBaseUrl.protocol !== 'https:') {
      return newErr({
        error: 'ConfigurationError',
        message: 'Import API must use HTTPS',
      });
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
      return newErr({
        error: 'InvalidResponse',
        message: 'Invalid terms response from import API',
      });
    }
    if (!terms.length) return newOkFromData({ data: [], totalResults: 0 });

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
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${config.importApiUsername}:${config.importApiPassword}`,
          'utf8',
        ).toString('base64')}`,
      },
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
      return newErr({
        error: 'InvalidResponse',
        message: 'Invalid resources response from import API',
      });
    }
    const data = [...result.deleted, ...result.resources];
    return newOkFromData({ data, totalResults: data.length });
  });

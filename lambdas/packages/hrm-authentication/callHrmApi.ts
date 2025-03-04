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

import { newErr, newOk, TResult } from '@tech-matters/types';
import { URLSearchParams } from 'url';

export type CallHrmApiParameters = {
  urlPath: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  authHeader: string;
  requestData?: any;
  body?: Record<string, any>;
};

export type CallHrmApiError = 'CallHrmApiError';

const callHrmApi = async <T = any>({
  urlPath,
  requestData,
  authHeader,
  method,
  body,
}: CallHrmApiParameters): Promise<TResult<CallHrmApiError, T>> => {
  try {
    const baseUrl = process.env.HRM_BASE_URL?.startsWith('https://')
      ? process.env.HRM_BASE_URL
      : `https://${process.env.HRM_BASE_URL}`;

    const params = new URLSearchParams(requestData).toString();
    const fullUrl = params ? `${baseUrl}/${urlPath}?${params}` : `${baseUrl}/${urlPath}`;

    // @ts-ignore global fetch available because node 18
    const response = await fetch(fullUrl, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      ...(body && { body: JSON.stringify(body) }),
    });

    if (!response.ok) {
      const error = await response.json();
      return newErr({
        message: JSON.stringify(error),
        error: 'CallHrmApiError',
      });
    }

    const data = (await response.json()) as T;
    return newOk({ data });
  } catch (err) {
    return newErr({
      message: err instanceof Error ? err.message : JSON.stringify(err),
      error: 'CallHrmApiError',
    });
  }
};

export default callHrmApi;

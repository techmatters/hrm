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

import { newErr, newOk } from '@tech-matters/types';
import { URLSearchParams } from 'url';

export type CallHrmApiParameters = {
  urlPath: string;
  authHeader: string;
  requestData?: any;
};

export type CallHrmApiError = 'UnauthorizedError';

const callHrmApi = async ({ urlPath, requestData, authHeader }: CallHrmApiParameters) => {
  const params = new URLSearchParams(requestData).toString();
  const fullUrl = params
    ? `${process.env.HRM_BASE_URL}/${urlPath}?${params}`
    : `${process.env.HRM_BASE_URL}/${urlPath}`;

  const response = await fetch(fullUrl, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
    },
  });

  if (!response.ok) {
    const error = (await response.json()) as any;
    return newErr({
      message: error.message,
      error: 'UnauthorizedError',
    });
  }

  const data = await response.json();
  return newOk({ data });
};

export default callHrmApi;

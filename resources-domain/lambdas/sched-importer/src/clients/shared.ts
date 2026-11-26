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

import { newErr, TResult } from '@tech-matters/types';
import type { TimeSequence } from '@tech-matters/resources-types';

export type NativeResource = Record<string, any>;
export type ApiResponse = {
  data: NativeResource[];
  totalResults: number;
  nextFrom?: TimeSequence;
};

export type ClientError =
  | 'HttpError'
  | 'InvalidResponse'
  | 'ConfigurationError'
  | 'UnexpectedError';
export type ClientResult = TResult<ClientError, ApiResponse>;
export type PullUpdates = (
  from: string,
  to: string,
  remaining: number,
) => Promise<ClientResult>;

export const nextTimeSequence = (timeSequence: TimeSequence): TimeSequence => {
  const [timestamp, sequence] = timeSequence.split('-');
  return `${Number(timestamp)}-${Number(sequence) + 1}`;
};

export const httpError = async (response: Response) =>
  newErr({
    error: 'HttpError' as const,
    message: `${response.status} (${
      response.statusText
    }). Response body: ${await response.text()}`,
  });

export const withClientErrors =
  (pull: PullUpdates): PullUpdates =>
  async (...args) => {
    try {
      return await pull(...args);
    } catch (error) {
      return newErr({
        error: 'UnexpectedError',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

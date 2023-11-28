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
import { TResult } from '@tech-matters/types';

/**
 * The object types that can be authenticated.
 */
const objectTypes = {
  contact: 'contact',
  case: 'case',
} as const;

export type HRMAuthenticationObjectTypes = keyof typeof objectTypes;

export const isAuthenticationObjectType = (
  type: string,
): type is HRMAuthenticationObjectTypes => Object.keys(objectTypes).includes(type);

export type HrmAuthenticateResult = TResult<true>;

export * from './callHrmApi';

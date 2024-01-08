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
import filesUrlsAuthenticator, {
  HrmAuthenticateFilesUrlsRequestData,
} from './filesUrlsAuthenticator';
import type { CallHrmApiError } from './callHrmApi';

/**
 * The authenticator will call the authenticator based on the type.
 * In a perfect world the hrm side of authentication would be a single endpoint
 * that would accept a common payload and return a common response.
 * And this very leaky abstraction would not be needed.
 *
 * For now we have to support multiple endpoints and multiple payloads with
 * different responses, so the function is basically an adapter.
 *
 * The goal was to keep all hrm authentication transformations centralized
 * in a single place to aid in the future refactoring.
 */
const types = {
  filesUrls: (params: HrmAuthenticateParameters) => filesUrlsAuthenticator(params),
};

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

export type HrmAuthenticateTypes = keyof typeof types;

export type HrmAuthenticateResult = TResult<CallHrmApiError, true>;

export type HrmAuthenticateParameters = {
  accountSid: string;
  objectType: HRMAuthenticationObjectTypes;
  objectId?: string;
  type: HrmAuthenticateTypes;
  authHeader: string;
  requestData: HrmAuthenticateFilesUrlsRequestData;
};

export const authenticate = async (
  params: HrmAuthenticateParameters,
): Promise<HrmAuthenticateResult> => {
  return types[params.type](params);
};

export { FileTypes } from './filesUrlsAuthenticator';

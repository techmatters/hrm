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
import { ErrorResult, SuccessResult, FileTypes } from '@tech-matters/types';
import filesUrlsAuthenticator from './filesUrlsAuthenticator';

const types = {
  filesUrls: (params: HrmAuthenticateParameters) => filesUrlsAuthenticator(params),
};

export type HrmAuthenticateTypes = keyof typeof types;

export type HrmAuthenticateSuccessResult = SuccessResult & {
  result: true;
};

export type HrmAuthenticateResult = ErrorResult | HrmAuthenticateSuccessResult;

export type HrmAuthenticateFilesUrlsRequestData = {
  method: string;
  bucket: string;
  key: string;
  fileType: FileTypes;
};

export type HrmAuthenticateParameters = {
  accountSid: string;
  objectType: string;
  objectId: string;
  type: HrmAuthenticateTypes;
  authHeader: string;
  requestData: HrmAuthenticateFilesUrlsRequestData;
};

export const authenticate = async (
  params: HrmAuthenticateParameters,
): Promise<HrmAuthenticateResult> => {
  console.log('authenticate', params);

  return types[params.type](params);
};

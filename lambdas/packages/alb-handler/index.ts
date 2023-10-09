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
import type { ALBEvent, ALBResult, APIGatewayEvent } from 'aws-lambda';
import { Result as R } from '@tech-matters/types';

const METHODS = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE',
} as const;

export type AlbHandlerEvent = ALBEvent | APIGatewayEvent;

export type AlbHandlerResult = ALBResult;

export type Methods = (typeof METHODS)[keyof typeof METHODS];

export type MethodHandler = (event: AlbHandlerEvent) => Promise<any>;

export type MethodHandlers = Partial<Record<Methods, MethodHandler>>;

export type HandleAlbEventParams = {
  event: AlbHandlerEvent;
  methodHandlers: MethodHandlers;
};

export type GetHeadersParams = {
  allowedMethods: string[];
};

export const getAllAllowedMethods = (allowedMethods: string[]) => [
  ...allowedMethods,
  'OPTIONS',
];

export const getHeaders = ({ allowedMethods }: GetHeadersParams) => ({
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': `${getAllAllowedMethods(allowedMethods).join(',')}`,
  'Access-Control-Allow-Headers':
    'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
});

export const handleAlbEvent = async ({
  event,
  methodHandlers,
}: HandleAlbEventParams): Promise<AlbHandlerResult> => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: getHeaders({ allowedMethods: Object.keys(methodHandlers) }),
      body: '',
    };
  }

  const methodHandler = methodHandlers[event.httpMethod as Methods];
  if (!methodHandler) {
    return {
      statusCode: 405,
      headers: getHeaders({ allowedMethods: Object.keys(methodHandlers) }),
    };
  }

  const result: R.TResult<any> = await methodHandler(event);

  if (R.isOk<any>(result)) {
    return {
      statusCode: 200,
      headers: getHeaders({ allowedMethods: Object.keys(methodHandlers) }),
      body: JSON.stringify(result.data),
    };
  }

  if (R.isErr(result)) {
    console.error(result.message);
    return {
      statusCode: result.statusCode,
      headers: getHeaders({ allowedMethods: Object.keys(methodHandlers) }),
      body: result.message,
    };
  }

  return {
    statusCode: 500,
    headers: getHeaders({ allowedMethods: Object.keys(methodHandlers) }),
  };
};

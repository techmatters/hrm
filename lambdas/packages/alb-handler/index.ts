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
import { TResult, isErr, isOk } from '@tech-matters/types';

const METHODS = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE',
} as const;

export type AlbHandlerEvent = ALBEvent | APIGatewayEvent;

export type AlbHandlerResult = ALBResult;

export type Methods = (typeof METHODS)[keyof typeof METHODS];

export type MethodHandler<TError extends string> = (
  event: AlbHandlerEvent,
) => Promise<TResult<TError, any>>;

export type MethodHandlers<TError extends string> = Partial<
  Record<Methods, MethodHandler<TError>>
>;

export type HandleAlbEventParams<TError extends string> = {
  event: AlbHandlerEvent;
  methodHandlers: MethodHandlers<TError>;
  mapError?: { [K in TError]: number };
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

export const handleAlbEvent = async <TError extends string>({
  event,
  methodHandlers,
  mapError,
}: HandleAlbEventParams<TError>): Promise<AlbHandlerResult> => {
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

  const result = await methodHandler(event);

  if (isOk<any>(result)) {
    return {
      statusCode: 200,
      headers: getHeaders({ allowedMethods: Object.keys(methodHandlers) }),
      body: JSON.stringify(result.data),
    };
  }

  if (isErr(result)) {
    console.error(result.message);
    return {
      statusCode: (mapError && mapError[result.error]) || 500,
      headers: getHeaders({ allowedMethods: Object.keys(methodHandlers) }),
      body: result.message,
    };
  }

  return {
    statusCode: 500,
    headers: getHeaders({ allowedMethods: Object.keys(methodHandlers) }),
  };
};

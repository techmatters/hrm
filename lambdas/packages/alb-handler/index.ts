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

/**
 * Event to be handled by the ALB handler
 *
 * We have to support both ALB and API Gateway events because
 * localstack does not support ALB events yet, so our local tests
 * will use API Gateway events.
 */
export type AlbHandlerEvent = ALBEvent | APIGatewayEvent;

export type AlbHandlerResult = ALBResult;

export type Methods = (typeof METHODS)[keyof typeof METHODS];

/**
 * A handler function that accepts an AlbHandlerEvent and returns a TResult.
 */
export type MethodHandler = (event: AlbHandlerEvent) => Promise<TResult<any>>;

/**
 * An object with the handlers for each available http method.
 * The key is the http method and the value is a handler function that returns a TResult.
 * The OPTIONS method is handled by the handler itself and cannot be overridden.
 * If a method is not present in this object, the handler will return a 405 error.
 */
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

/**
 * Handle an ALB event
 *
 * @param {AlbHandlerEvent} params.event - The ALB or API Gateway event to be handled
 * @param {MethodHandlers} params.methodHandlers - An object with the handlers for each available http method
 * @returns {Promise<AlbHandlerResult>} - The result of the handler function converted to an ALB result
 */
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

  const result: TResult<any> = await methodHandler(event);

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

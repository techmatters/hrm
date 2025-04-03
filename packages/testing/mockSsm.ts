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

// eslint-disable-next-line import/no-extraneous-dependencies,prettier/prettier
import type { Mockttp } from 'mockttp';

type GetPayload = {
  Name: string;
};

type FindPayload = {
  Path: string;
  MaxResults: number;
  NextToken?: string;
};

type MockParameter = (
  | {
      valueGenerator: () => string;
      updateable?: false;
    }
  | { valueGenerator?: () => string; updateable: true }
) &
  (
    | {
        name: string;
        pathPattern?: RegExp;
      }
    | {
        name?: string;
        pathPattern: RegExp;
      }
  );
const NOT_FOUND_RESPONSE = {
  statusCode: 404,
  headers: {
    'x-amzn-errortype': 'ParameterNotFound',
  },
};

const ALREADY_EXISTS_RESPONSE = {
  statusCode: 400,
  headers: {
    'x-amzn-errortype': 'ParameterAlreadyExists',
  },
};

let currentPriority = 1;

const singleKeyValues: Record<string, string | (() => string) | null> = {};
const regexValues: { pathPattern: RegExp; valueGenerator: () => string }[] = [];

export const mockSsmParameters = async (
  mockttp: Mockttp,
  parameters: MockParameter[] = [],
) => {
  console.debug('Mocking SSM parameters with priority: ', currentPriority);
  if (currentPriority === 1) {
    await mockttp
      .forPost(/http:\/\/mock-ssm(.*)/)
      .always()
      .asPriority(currentPriority++)
      .thenCallback(async req => {
        if (req.headers['x-amz-target'] === 'AmazonSSM.PutParameter') {
          const { Name, Value, Overwrite } = (await req.body.getJson()) as {
            Name: string;
            Value: string;
            Overwrite: boolean;
          };
          if (!Overwrite && singleKeyValues[Name] !== undefined) {
            return ALREADY_EXISTS_RESPONSE;
          }
          console.debug(`Receiving SSM PutParameter command to set ${Name}=${Value}`);
          singleKeyValues[Name] = Value;
          return {
            statusCode: 200,
            body: JSON.stringify({
              Version: 3,
              Tier: 'Standard',
            }),
          };
        }
        const requestBody = await req.body.getText();
        const {
          Name: name,
          Path: path,
          MaxResults: maxResults,
          NextToken: nextToken,
        }: GetPayload & FindPayload = JSON.parse(requestBody!);
        if (name) {
          // This is a get request for a single parameter
          // See if a specific value for the key was set up in the test or written by the application
          let value: string | null = null;
          if (typeof singleKeyValues[name] === 'string') {
            console.debug(
              `Returning updated value for ${name}: ${singleKeyValues[name]}`,
            );
            value = singleKeyValues[name];
          } else if (typeof singleKeyValues[name] === 'function') {
            value = singleKeyValues[name]();
            console.debug(`Returning mocked value for ${name}: ${value}`);
          } else {
            for (const regexValue of regexValues) {
              if (regexValue.pathPattern?.test(name)) {
                value = regexValue.valueGenerator();
              }
            }
          }
          return value !== null
            ? {
                statusCode: 200,
                body: JSON.stringify({
                  Parameter: {
                    ARN: 'string',
                    DataType: 'text',
                    LastModifiedDate: 0,
                    Name: name,
                    Selector: 'string',
                    SourceResult: 'string',
                    Type: 'SecureString',
                    Value: value,
                    Version: 3,
                  },
                }),
              }
            : NOT_FOUND_RESPONSE;
        } else if (path) {
          // This is a find request for multiple parameters that we need to filter.
          // Where we also need to handle pagination with NextToken or requests & responses.
          // pathPattern on parameters is ignored in this case, since it doesn't really make sense.
          // Note: doesn't currently support filters, only a path.
          const pathRegex = new RegExp(`${path}/.*`);
          const matchingParameters = Object.entries(singleKeyValues).filter(([ssmKey]) =>
            pathRegex.test(ssmKey),
          );
          const windowStart = nextToken ? parseInt(nextToken, 10) : 0;
          const windowedParameters = matchingParameters.slice(
            windowStart,
            windowStart + (maxResults ?? 10),
          );
          const responseNextToken =
            windowedParameters.length === (maxResults ?? 10)
              ? (windowStart + maxResults).toString()
              : undefined;
          const payload: any = {
            Parameters: windowedParameters.map(([ssmKey, ssmValue]) => ({
              ARN: 'string',
              DataType: 'text',
              LastModifiedDate: 0,
              Name: ssmKey,
              Selector: 'string',
              SourceResult: 'string',
              Type: 'SecureString',
              Value: typeof ssmValue === 'function' ? ssmValue() : ssmValue,
              Version: 3,
            })),
          };
          if (responseNextToken) {
            payload.NextToken = responseNextToken;
          }
          return {
            statusCode: 200,
            body: JSON.stringify(payload),
          };
        }
        return NOT_FOUND_RESPONSE;
      });
  }

  for (const parameter of parameters) {
    if (parameter.name && parameter.valueGenerator) {
      singleKeyValues[parameter.name] = parameter.valueGenerator;
    }
    if (parameter.pathPattern && parameter.valueGenerator) {
      regexValues.push({
        pathPattern: parameter.pathPattern,
        valueGenerator: parameter.valueGenerator,
      });
    }
  }
  // console.info('Mocked SSM on mock-ssm: ', parameters);
};

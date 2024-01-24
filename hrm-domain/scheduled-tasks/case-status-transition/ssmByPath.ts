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

import { getSsmClient } from '@tech-matters/ssm-cache';
import {
  GetParametersByPathCommand,
  GetParametersByPathCommandInput,
  Parameter,
} from '@aws-sdk/client-ssm';
export const findSsmParametersByPath = async (path: string): Promise<Parameter[]> => {
  const client = getSsmClient();
  let nextToken: string | undefined;
  const foundParameters: Parameter[] = [];
  do {
    const params: GetParametersByPathCommandInput = {
      MaxResults: 10, // 10 is max allowed by AWS
      Path: path,
      Recursive: true,
      WithDecryption: true,
    };

    if (nextToken) params.NextToken = nextToken;

    const command = new GetParametersByPathCommand(params);

    const resp = await client.send(command);

    foundParameters.push(...(resp.Parameters ?? []));
    nextToken = resp.NextToken;
  } while (nextToken);
  return foundParameters;
};

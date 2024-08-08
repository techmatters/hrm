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
  DeleteParameterCommand,
  DeleteParameterCommandOutput,
  PutParameterCommand,
  PutParameterCommandOutput,
} from '@aws-sdk/client-ssm';

export const putParameter = async (
  parameterSuffix: string,
  value: string,
): Promise<PutParameterCommandOutput[]> =>
  Promise.all(
    ['test', 'local'].map(env => {
      console.log(`Creating /${env}/us-east-1/${parameterSuffix}`);
      return getSsmClient().send(
        new PutParameterCommand({
          Name: `/${env}/us-east-1/${parameterSuffix}`,
          Value: value,
          Type: 'SecureString',
          Overwrite: true,
        }),
      );
    }),
  );

export const deleteParameter = async (
  parameterSuffix: string,
): Promise<DeleteParameterCommandOutput[]> =>
  Promise.all(
    ['test', 'local'].map(env =>
      getSsmClient().send(
        new DeleteParameterCommand({
          Name: `/${env}/us-east-1/${parameterSuffix}`,
        }),
      ),
    ),
  );

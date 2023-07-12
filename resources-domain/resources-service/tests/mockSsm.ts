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

export const mockSsmParameters = async (
  mockttp: Mockttp,
  parameters: { pathPattern: RegExp; valueGenerator: () => string }[],
) => {
  await mockttp.forPost(/(.*)mock-ssm(.*)/).thenCallback(async req => {
    const { Name: name }: { Name: string } = ((await req.body.getJson()) as {
      Name: string;
    }) ?? {
      Name: '',
    };
    for (const parameter of parameters) {
      if (parameter.pathPattern.test(name)) {
        return {
          status: 200,
          body: JSON.stringify({
            Parameter: {
              ARN: 'string',
              DataType: 'text',
              LastModifiedDate: 0,
              Name: name,
              Selector: 'string',
              SourceResult: 'string',
              Type: 'SecureString',
              Value: parameter.valueGenerator(),
              Version: 3,
            },
          }),
        };
      }
    }
    return { status: 404 };
  });
};

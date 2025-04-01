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

import { ConnectionConfig, connectToPostgres } from './connectionPool';
import {
  getSsmParameter,
  putSsmParameter,
  SsmParameterNotFound,
} from '@tech-matters/ssm-cache';
import { randomUUID } from 'node:crypto';
import { CREATE_DYNAMIC_USER_SQL } from './createDynamicUserSql';

export type Database = ReturnType<typeof connectToPostgres>;

export const connectToPostgresWithDynamicUser = (
  adminConnectionConfig: ConnectionConfig,
  dynamicUserPrefix: string,
  role: string,
  getPasswordSsmKey: (dynamicUserKey: string) => string,
): ((dynamicUserKey: string) => Promise<Database>) => {
  let lazyAdminConnection: Database | undefined = undefined;
  const connectionPoolMap: Record<string, Database> = {};

  return async (dynamicUserKey: string) => {
    if (!connectionPoolMap[dynamicUserKey]) {
      let password: string;
      const passwordSsmKey = getPasswordSsmKey(dynamicUserKey);
      const user = `${dynamicUserPrefix}${dynamicUserKey}`;
      try {
        password = await getSsmParameter(passwordSsmKey);
      } catch (error) {
        if (error instanceof SsmParameterNotFound) {
          password = randomUUID();
          await putSsmParameter(passwordSsmKey, password);
          if (!lazyAdminConnection) {
            lazyAdminConnection = connectToPostgres({
              ...adminConnectionConfig,
              poolSize: 1,
            });
          }
          await lazyAdminConnection.none(CREATE_DYNAMIC_USER_SQL, {
            role,
            password,
            user,
          });
        } else throw error;
      }
      connectionPoolMap[dynamicUserKey] = connectToPostgres({
        ...adminConnectionConfig,
        user,
        password,
        poolSize: 5,
      });
    }
    return connectionPoolMap[dynamicUserKey];
  };
};

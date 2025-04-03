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
  SsmParameterAlreadyExists,
  SsmParameterNotFound,
} from '@tech-matters/ssm-cache';
import { randomUUID } from 'node:crypto';
import {
  CREATE_DYNAMIC_USER_SQL,
  RESET_DYNAMIC_USER_PASSWORD_SQL,
} from './createDynamicUserSql';

const MAX_ATTEMPTS = 5;

export type Database = ReturnType<typeof connectToPostgres>;

export const connectToPostgresWithDynamicUser = (
  adminConnectionConfig: ConnectionConfig,
  dynamicUserPrefix: string,
  role: string,
  getPasswordSsmKey: (dynamicUserKey: string) => string,
): ((dynamicUserKey: string) => Promise<Database>) => {
  let lazyAdminConnection: Database | undefined = undefined;
  const connectionPoolMap: Record<string, Database> = {};

  const connect = async (dynamicUserKey: string, attempt: number) => {
    if (!connectionPoolMap[dynamicUserKey]) {
      let password: string;
      const passwordSsmKey = getPasswordSsmKey(dynamicUserKey);
      const user = `${dynamicUserPrefix}${dynamicUserKey}`;
      try {
        password = await getSsmParameter(passwordSsmKey);
      } catch (error) {
        if (error instanceof SsmParameterNotFound) {
          password = randomUUID();
          // Don't cache the value in case another process is trying to create the same user at the same time
          // If that happens the password could be overwritten by the time we use it
          try {
            await putSsmParameter(passwordSsmKey, password, { cacheValue: false });
          } catch (ssmUpdateError) {
            if (ssmUpdateError instanceof SsmParameterAlreadyExists) {
              // If the parameter already exists, it was set after we initially read it, so we need to read it again
              if (attempt < MAX_ATTEMPTS) {
                return connect(dynamicUserKey, attempt + 1);
              } else
                throw new Error(
                  `Failed to optimistically read/set password in SSM after ${MAX_ATTEMPTS} attempts. It should only ever fail once.`,
                );
            }
          }
          if (!lazyAdminConnection) {
            lazyAdminConnection = connectToPostgres({
              ...adminConnectionConfig,
              poolSize: 1,
            });
          }
          try {
            await lazyAdminConnection.none(CREATE_DYNAMIC_USER_SQL, {
              role,
              password,
              user,
            });
          } catch (dbError) {
            if (
              dbError instanceof Error &&
              dbError.message === `role "${user}" already exists`
            ) {
              console.warn(
                `User ${user} already exists but had no SSM parameter set for their password, resetting the database user password to match the one in SSM. [THIS IS EXPECTED IN SERVICE TESTS]`,
              );
              await lazyAdminConnection.none(RESET_DYNAMIC_USER_PASSWORD_SQL, {
                password,
                user,
              });
            }
          }
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
  return key => connect(key, 0);
};

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

const MAX_ATTEMPTS = 15;
const PENDING_PASSWORD = '__pending';

export type Database = ReturnType<typeof connectToPostgres>;

export const connectToPostgresWithDynamicUser = (
  adminConnectionConfig: ConnectionConfig,
  dynamicUserPrefix: string,
  role: string,
  getPasswordSsmKey: (dynamicUserKey: string) => string,
): ((dynamicUserKey: string) => Promise<Database>) => {
  let lazyAdminConnection: Database | undefined = undefined;
  const connectionPoolMap: Record<string, Database> = {};

  const createNewUser = async (
    user: string,
    passwordSsmKey: string,
    overwriteSsm: boolean,
  ) => {
    const password = randomUUID();
    // Don't cache the value in case another process is trying to create the same user at the same time
    // If that happens the password could be overwritten by the time we use it
    await putSsmParameter(passwordSsmKey, PENDING_PASSWORD, {
      cacheValue: false,
      overwrite: overwriteSsm,
      secure: true,
    });
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
      } else throw dbError;
    }
    await putSsmParameter(passwordSsmKey, password, {
      cacheValue: false,
      overwrite: true,
      secure: true,
    });
    return password;
  };

  const connect = async (dynamicUserKey: string, attempt: number): Promise<Database> => {
    if (!connectionPoolMap[dynamicUserKey]) {
      let password: string;
      const passwordSsmKey = getPasswordSsmKey(dynamicUserKey);
      const user = `${dynamicUserPrefix}${dynamicUserKey}`;
      try {
        password = await getSsmParameter(passwordSsmKey);
        if (password === PENDING_PASSWORD) {
          if (attempt <= MAX_ATTEMPTS) {
            // Another process or task in this process is creating the user, we need to wait for it to finish
            console.debug(
              `Waiting for another process to create the user ${user}, check ${
                attempt + 1
              } / ${MAX_ATTEMPTS}`,
              user,
            );
            return await new Promise(resolve => {
              setTimeout(() => resolve(connect(dynamicUserKey, attempt + 1)), 200);
            });
          } else {
            console.error(
              `Timed out waiting for another task to create the user ${user}, creating it now. This could cause temporary connection issues if the other task finishes after this one.`,
            );
            password = await createNewUser(user, passwordSsmKey, true);
          }
        }
      } catch (error) {
        if (error instanceof SsmParameterNotFound) {
          try {
            password = await createNewUser(user, passwordSsmKey, false);
          } catch (createUserError) {
            if (createUserError instanceof SsmParameterAlreadyExists) {
              // Another process created the parameter after we initally checked, go around again
              return connect(dynamicUserKey, attempt + 1);
            } else throw createUserError;
          }
        } else throw error;
      }
      connectionPoolMap[dynamicUserKey] = connectToPostgres({
        ...adminConnectionConfig,
        user,
        password,
        poolSize: 5,
        connectionTimeoutMillis: 10000, // 10s: fail if can't connect
        statement_timeout: 120000, // 120s: server fail if query takes longer
        query_timeout: 150000, // 150s: client fail if query takes longer
      });
    }
    return connectionPoolMap[dynamicUserKey];
  };
  return key => connect(key, 0);
};

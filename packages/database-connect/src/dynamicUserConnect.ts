import { ConnectionConfig, connectToPostgres } from './connectionPool';
import {
  getSsmParameter,
  putSsmParameter,
  SsmParameterNotFound,
} from '@tech-matters/ssm-cache';
import { randomUUID } from 'node:crypto';
import { CREATE_DYNAMIC_USER_SQL } from './createDynamicUserSql';

type Database = ReturnType<typeof connectToPostgres>;

export const connectToPostgresWithDynamicUser = (
  environment: 'production' | 'staging' | 'development',
  adminConnectionConfig: ConnectionConfig,
  dynamicUserPrefix: string,
  role: string,
): ((dynamicUserKey: string) => Promise<Database>) => {
  let lazyAdminConnection: Database | undefined = undefined;
  const connectionPoolMap: Record<string, Database> = {};

  return async (dynamicUserKey: string) => {
    if (!connectionPoolMap[dynamicUserKey]) {
      let password: string;
      const passwordSsmKey = `/${environment}/hrm/database/${dynamicUserKey}/password`;
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

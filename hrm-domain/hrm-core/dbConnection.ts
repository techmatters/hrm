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

import {
  connectToPostgres,
  connectToPostgresWithDynamicUser,
  Database,
} from '@tech-matters/database-connect';
import adminConnectionConfig from './config/db';
import { enableDbUserPerAccount } from './featureFlags';
export { pgp } from '@tech-matters/database-connect';

let dbWithAdmin: Database;

type DB = ReturnType<typeof connectToPostgres>;

export const getDbForAdmin = (): DB => {
  // Instantiate lazily because only the poller instance uses this
  if (!dbWithAdmin) {
    dbWithAdmin = connectToPostgres({
      ...adminConnectionConfig,
      applicationName: 'hrm-service',
    });
  }
  return dbWithAdmin;
};

export const db: DB = connectToPostgres({
  ...adminConnectionConfig,
  applicationName: 'hrm-service',
});

export const getDbForAccount = enableDbUserPerAccount
  ? connectToPostgresWithDynamicUser(
      {
        ...adminConnectionConfig,
        applicationName: 'hrm-service',
      },
      'hrm_account_',
      'hrm_service',
      accountSid => `/${process.env.NODE_ENV}/hrm/${accountSid}/database/password`,
    )
  : () => Promise.resolve(getDbForAdmin());

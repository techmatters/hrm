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

import { db } from '../connection-pool';
import { AccountSID } from '@tech-matters/twilio-worker-auth';
import { SELECT_RESOURCE_BY_ID } from './sql/resource-get-sql';

export type ReferreableResource = {
  name: string;
  id: string;
};

export const getById = async (
  accountSid: AccountSID,
  resourceId: string,
): Promise<ReferreableResource | null> =>
  db.task(async t => t.oneOrNone(SELECT_RESOURCE_BY_ID, { accountSid, resourceId }));

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

import { renotify } from '../renotify';

export const command = 'hrm';
export const describe = 'Reindex contacts and cases based on date range';

export const builder = {
  c: {
    alias: 'contacts',
    describe: 'reindex contacts',
    type: 'boolean',
    default: false,
  },
  s: {
    alias: 'cases',
    describe: 'reindex cases',
    type: 'boolean',
    default: false,
  },
  e: {
    alias: 'environment',
    describe: 'environment (e.g. development, staging, production)',
    demandOption: true,
    type: 'string',
  },
  r: {
    alias: 'region',
    describe: 'region (e.g. us-east-1)',
    demandOption: true,
    type: 'string',
  },
  a: {
    alias: 'accounts',
    describe: 'list of accounts short codes (e.g. -a=AS ZA)',
    demandOption: true,
    type: 'array',
  },
  f: {
    alias: 'dateFrom',
    describe: 'start date (e.g. 2024-01-01)',
    demandOption: true,
    type: 'string',
  },
  t: {
    alias: 'dateTo',
    describe: 'end date (e.g. 2024-12-31)',
    demandOption: true,
    type: 'string',
  },
};

export const handler = async ({
  region,
  environment,
  accounts,
  dateFrom,
  dateTo,
  contacts,
  cases,
}) => {
  console.info('Reindexing entities');
  const allEntities = !contacts && !cases;
  if (allEntities) {
    console.info('No entity type specified so re-indexing all');
  }
  try {
    await renotify({
      accounts,
      dateFrom,
      dateTo,
      environment,
      operation: 'reindex',
      cases: cases || allEntities,
      contacts: contacts || allEntities,
      profiles: false, // not implemented
      region,
    });
  } catch (err) {
    console.error(err);
  }
};

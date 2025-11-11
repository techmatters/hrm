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

// eslint-disable-next-line import/no-extraneous-dependencies
import yargs from 'yargs';
import { SearchReindexParams } from '../../src/admin/adminSearchService';
import { AccountSID } from '@tech-matters/types';
import { getHRMInternalEndpointAccess } from '@tech-matters/service-discovery';

const reindexResources = async <T extends boolean>(
  internalResourcesUrl: URL,
  authKey: string,
  reindexParameters: SearchReindexParams,
  verbose: T,
): Promise<Response> => {
  const reindexUrl = new URL(
    `v0/resources/admin/search/reindex?responseType=${verbose ? 'verbose' : 'concise'}`,
    internalResourcesUrl,
  );
  console.info(`Submitting reindex request to ${reindexUrl}`);
  const resp = await fetch(reindexUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${authKey}`,
    },
    body: JSON.stringify(reindexParameters),
  });
  if (resp.ok) {
    return resp;
  } else {
    throw new Error(`Failed to submit request: ${resp.statusText}`);
  }
};

const main = async () => {
  const {
    a: accountSid,
    e: environment,
    r: resourceIds,
    t: to,
    f: from,
    v: verbose,
  } = yargs(process.argv.slice(2))
    .options({
      e: {
        alias: 'environment',
        describe: 'The environment to reindex, defaults to development',
        type: 'string',
        default: 'development',
      },
      a: {
        alias: 'accountSid',
        describe:
          "Specify this to restrict the reindexing to resources from a single account, e.g. -a AC000000000 or --accountSid AC000000000. If you don't specfiy this, all accounts in the time range you specify will be reindexed. You must specify this if you specify individual resourceIDs (-r, --resourceId).",
        type: 'string',
      },
      r: {
        alias: 'resourceId',
        describe:
          'Used to specify individual resourceIDs. If this is specified, and account SID (-a, --accountSid) must also be specified. Can be specified multiple times',
        type: 'array',
      },
      f: {
        alias: 'from',
        describe:
          'Used to set the earliest date that a resource was last updated to be a candidate for reindexing. Must be an ISO 8601 date string, e.g. -f 2021-01-01T00:00:00.000Z will index only resources updated after 2021-01-01',
        type: 'string',
      },
      t: {
        alias: 'to',
        describe:
          'Used to set the latest date that a resource was last updated to be a candidate for reindexing. Must be an ISO 8601 date string, e.g. -f 2021-01-01T00:00:00.000Z will index only resources updated before 2021-01-01',

        type: 'string',
      },
      v: {
        alias: 'verbose',
        describe:
          'Specify this to get a more verbose output, including the IDs of successfully submitted resources, and the IDs and associated errors of resources that failed to submit for reindexing.',
        type: 'boolean',
        default: false,
      },
    })
    .parseSync();
  const region = process.env.AWS_REGION;
  if (!region) {
    throw new Error(`region parameter not provided nor set in .env`);
  }

  const timestamp = new Date().getTime();
  const assumeRoleParams = {
    RoleArn: 'arn:aws:iam::712893914485:role/tf-admin',
    RoleSessionName: `es-reindex-${timestamp}`,
  };

  const { authKey, internalResourcesUrl } = await getHRMInternalEndpointAccess({
    region,
    environment,
    assumeRoleParams,
  });

  const reindexParameters: SearchReindexParams = {
    accountSid: accountSid as AccountSID,
    resourceIds: resourceIds?.map(rid => rid.toString()),
    lastUpdatedFrom: from,
    lastUpdatedTo: to,
  };
  const response = await reindexResources(
    internalResourcesUrl,
    authKey,
    reindexParameters,
    true,
  );
  if (!response.ok) {
    throw new Error(`Failed to submit reindex request: ${response.statusText}`);
  }
  if (!response.body) {
    throw new Error(`Failed to get response body from reindex request`);
  }
  console.log(`Response headers received, receiving results...`);

  for await (const chunk of response.body) {
    if (verbose) {
      process.stdout.write(chunk);
    }
  }
  console.log(`All results received, reindex complete`);
};

main().catch(err => {
  console.error(err);
  process.exit(1);
});

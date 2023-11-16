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

// TODO: needs to be converted to aws-sdk-v3
import { ECS, EC2, S3, STS } from 'aws-sdk';
// eslint-disable-next-line import/no-extraneous-dependencies
import yargs from 'yargs';
import { SearchReindexParams } from '../../src/admin/adminSearchService';
import { AccountSID } from '@tech-matters/types';
// eslint-disable-next-line import/no-extraneous-dependencies
import { fetch, Response } from 'undici';

const staticKeyPattern = /^STATIC_KEY_SEARCH_REINDEXER=(?<key>.*)$/im;

const findTaskPrivateIp = async (
  ecs: ECS,
  ec2: EC2,
  params: { cluster: string; serviceName: string },
) => {
  const tasks = await ecs.listTasks(params).promise();
  const taskArns = tasks.taskArns ?? [];
  const describeParams = {
    cluster: params.cluster,
    tasks: taskArns,
  };
  const taskData = await ecs.describeTasks(describeParams).promise();
  const task = taskData!.tasks![0];
  if (!task) {
    throw new Error(`No task found for service ${params.serviceName}`);
  }

  const networkInterfaceDetails = task.attachments![0].details!.find(
    detail => detail.name === 'networkInterfaceId',
  );

  if (!networkInterfaceDetails) {
    throw new Error(`Could not find network interface details for task ${task.taskArn}`);
  }

  const networkInterfaceId = networkInterfaceDetails.value ?? '';
  const describeNetworkInterfacesParams = {
    NetworkInterfaceIds: [networkInterfaceId],
  };
  const networkInterfaceDescription = await ec2
    .describeNetworkInterfaces(describeNetworkInterfacesParams)
    .promise();

  if (!networkInterfaceDescription.NetworkInterfaces) {
    throw new Error(`Could not find network interfaces with network interface IDid task`);
  }

  const networkInterface = networkInterfaceDescription.NetworkInterfaces[0];
  const privateIpAddress = networkInterface.PrivateIpAddress;

  if (!privateIpAddress) {
    throw new Error(
      `Could not find private IP address on network interface ${networkInterfaceId} for task`,
    );
  }
  console.log('Found the resources service private IP:', privateIpAddress);

  return privateIpAddress;
};

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
  const sts = new STS();
  const timestamp = new Date().getTime();
  const params = {
    RoleArn: 'arn:aws:iam::712893914485:role/admin-no-pii',
    RoleSessionName: `es-reindex-${timestamp}`,
  };
  const { Credentials } = await sts.assumeRole(params).promise();
  const credentials = {
    accessKeyId: Credentials?.AccessKeyId,
    secretAccessKey: Credentials?.SecretAccessKey,
    sessionToken: Credentials?.SessionToken,
  };

  const ecs = new ECS({
    credentials,
    region,
  });
  const ec2 = new EC2({
    credentials,
    region,
  });
  const s3 = new S3({
    credentials,
    region,
  });

  const privateIpAddress = await findTaskPrivateIp(ecs, ec2, {
    cluster: `${environment}-ecs-cluster`,
    serviceName: `${environment}-ecs-service`,
  });
  const internalResourcesUrl = new URL('http://localhost');
  internalResourcesUrl!.hostname = privateIpAddress;
  internalResourcesUrl!.port = '8081';

  const { Body } = await s3
    .getObject({
      Bucket: `tl-hrm-vars-${environment}${region === 'us-east-1' ? '' : `-${region}`}`,
      Key: `${environment}.env`,
    })
    .promise();
  if (!Body) {
    throw new Error('Failed to load environment variables file from S3');
  }
  const authKey = Body.toString().match(staticKeyPattern)?.groups?.key;
  if (!authKey) {
    throw new Error(
      'Found the HRM .env file but failed to find the auth key under a STATIC_KEY_SEARCH_REINDEXER entry',
    );
  }
  console.log(`Found auth key ${authKey}`);
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

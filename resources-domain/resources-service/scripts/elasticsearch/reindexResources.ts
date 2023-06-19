import { ECS, EC2, S3 } from 'aws-sdk';
// eslint-disable-next-line import/no-extraneous-dependencies
import yargs from 'yargs';
import {
  ConciseSearchReindexResult,
  SearchReindexParams,
  VerboseSearchReindexResult,
} from '../../src/admin/adminSearchService';
import { AccountSID } from '@tech-matters/types';
// eslint-disable-next-line import/no-extraneous-dependencies
import { fetch } from 'undici';

const ecs = new ECS();
const ec2 = new EC2();
const s3 = new S3();

const staticKeyPattern = /^STATIC_KEY_SEARCH_REINDEXER=(?<key>.*)$/im;

const findTaskPrivateIp = async (params: { cluster: string; serviceName: string }) => {
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

type ReindexReturnType<T extends boolean> = T extends true
  ? VerboseSearchReindexResult
  : T extends false
  ? ConciseSearchReindexResult
  : never;

const reindexResources = async <T extends boolean>(
  internalResourcesUrl: URL,
  authKey: string,
  reindexParameters: SearchReindexParams,
  verbose: T,
): Promise<ReindexReturnType<T>> => {
  const resp = await fetch(
    new URL(
      `v0/resources/admin/search/reindex?responseType=${verbose ? 'verbose' : 'concise'}`,
      internalResourcesUrl,
    ).toString(),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${authKey}`,
      },
      body: JSON.stringify(reindexParameters),
    },
  );
  if (resp.ok) {
    return (await resp.json()) as ReindexReturnType<typeof verbose>;
  } else {
    throw new Error(`Failed to submit request: ${resp.statusText}`);
  }
};

const main = async () => {
  const { a: accountSid, e: environment, r: resourceIds, t: to, f: from, v: verbose } = yargs(
    process.argv.slice(2),
  )
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
  const privateIpAddress = await findTaskPrivateIp({
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
  const reindexParameters: SearchReindexParams = {
    accountSid: accountSid as AccountSID,
    resourceIds: resourceIds?.map(rid => rid.toString()),
    lastUpdatedFrom: from,
    lastUpdatedTo: to,
  };
  if (verbose) {
    const response = await reindexResources(internalResourcesUrl, authKey, reindexParameters, true);
    console.info(
      `Reindex complete, the following ${response.successfulSubmissionCount} resources successfully submitted for reindexing`,
      response.successfullySubmitted
        .map(
          ({ accountSid: resourceAccountSid, resourceId }) => `${resourceAccountSid}/${resourceId}`,
        )
        .join(', '),
    );
    if (response.submissionErrorCount) {
      console.error(
        `There were also these ${response.submissionErrorCount} resources that failed to submit for reindexing:`,
      );
      response.failedToSubmit.forEach(({ accountSid: resourceAccountSid, resourceId, error }) => {
        console.error(`Resource ID: ${resourceAccountSid}/${resourceId}, Error: ${error}`);
      });
    }
  } else {
    const response = await reindexResources(
      internalResourcesUrl,
      authKey,
      reindexParameters,
      false,
    );
    console.info(
      `Reindex complete, ${response.successfulSubmissionCount} resources successfully submitted for reindexing`,
    );
    if (response.submissionErrorCount) {
      console.error(
        `There were also ${response.submissionErrorCount} resources that failed to submit for reindexing:`,
      );
    }
  }
};

main().catch(err => {
  console.error(err);
  process.exit(1);
});

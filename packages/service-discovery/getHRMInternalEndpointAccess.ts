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
import { ECS, EC2, STS } from 'aws-sdk';
import { getSsmParameter } from '@tech-matters/ssm-cache';

/**
 * Returns the private IP address of the first task defined under the cluster - serviceName service discovery registry
 */
const findTaskPrivateIp = async ({
  region,
  environment,
  credentials,
}: {
  region: string;
  environment: string;
  credentials: { accessKeyId: string; secretAccessKey: string; sessionToken: string };
}) => {
  const ecs = new ECS({
    credentials,
    region,
  });
  const ec2 = new EC2({
    credentials,
    region,
  });

  const cluster = `${environment}-ecs-cluster`;
  const serviceName = `${environment}-ecs-service`;

  const tasks = await ecs.listTasks({ cluster, serviceName }).promise();
  const taskArns = tasks.taskArns ?? [];
  const describeParams = {
    cluster: cluster,
    tasks: taskArns,
  };
  const taskData = await ecs.describeTasks(describeParams).promise();
  const task = taskData!.tasks![0];
  if (!task) {
    throw new Error(`No task found for service ${serviceName}`);
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

export const getHRMInternalEndpointAccess = async ({
  region,
  environment,
  assumeRoleParams,
}: {
  region: string;
  environment: string;
  assumeRoleParams: {
    RoleArn: string;
    RoleSessionName: string;
  };
}) => {
  const sts = new STS();
  const { Credentials } = await sts.assumeRole(assumeRoleParams).promise();
  const credentials = {
    accessKeyId: Credentials!.AccessKeyId,
    secretAccessKey: Credentials!.SecretAccessKey,
    sessionToken: Credentials!.SessionToken,
  };

  const privateIpAddress = await findTaskPrivateIp({
    region,
    environment,
    credentials,
  });

  const internalResourcesUrl = new URL('http://localhost');
  internalResourcesUrl!.hostname = privateIpAddress;
  internalResourcesUrl!.port = '8081';

  const authKey = await getSsmParameter(
    `/${environment}/hrm/service/${region}/static_key/ADMIN_HRM`,
  );

  return {
    internalResourcesUrl,
    authKey,
  };
};

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

import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts';

/**
 * Roles assumed by the admin CLI. Add any new ones here, so all the role handling stays in this file
 */
export const ROLE_ARNS = {
  tfAdmin: 'arn:aws:iam::712893914485:role/tf-admin',
} as const;

export type AwsCredentials = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
};

export const getAssumeRoleParams = (
  roleArn: string,
  sessionNamePrefix: string = 'hrm-admin-cli',
) => ({
  RoleArn: roleArn,
  RoleSessionName: `${sessionNamePrefix}-${Date.now()}`,
});

/**
 * The STS region falls back to the AWS SDK default resolution (env vars / profile) if not provided
 */
export const assumeRoleCredentials = async (
  assumeRoleParams: ReturnType<typeof getAssumeRoleParams>,
  region?: string,
): Promise<AwsCredentials> => {
  const sts = new STSClient({ region });
  const { Credentials } = await sts.send(new AssumeRoleCommand(assumeRoleParams));
  return {
    accessKeyId: Credentials!.AccessKeyId!,
    secretAccessKey: Credentials!.SecretAccessKey!,
    sessionToken: Credentials!.SessionToken!,
  };
};

/**
 * For getHRMInternalEndpointAccess, which assumes the role itself
 */
export const getTfAdminAssumeRoleParams = () => getAssumeRoleParams(ROLE_ARNS.tfAdmin);

export const assumeTfAdminRole = (region?: string) =>
  assumeRoleCredentials(getTfAdminAssumeRoleParams(), region);

export type CredentialsProvider = () => Promise<AwsCredentials>;

/**
 * Returns a credentials provider that only assumes the tf-admin role the first time credentials are needed,
 * so commands that end up not using them never assume it, and the ones that use them several times assume it once
 */
export const lazyTfAdminCredentials = (): CredentialsProvider => {
  let credentials: Promise<AwsCredentials> | undefined;
  return () => {
    credentials ??= assumeTfAdminRole();
    return credentials;
  };
};

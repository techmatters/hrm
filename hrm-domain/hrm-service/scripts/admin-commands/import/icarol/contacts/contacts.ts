/**
 * Copyright (C) 2021-2026 Technology Matters
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
import { parse } from 'csv-parse/sync';
import { getHRMInternalEndpointAccess } from '@tech-matters/service-discovery';
import { getS3Object } from '@tech-matters/s3-client';
import { getSsmParameter } from '@tech-matters/ssm-cache';
import { getClient } from '@tech-matters/twilio-client';
import type { HrmAccountId, WorkerSID } from '@tech-matters/types';
import { getAdminV0URL } from '../../../../hrmInternalConfig';
import {
  ICarolContactRecord,
  mapContact,
  parseS3Uri,
  WorkerSidsByName,
} from './contactMapper';

export const command = 'contacts';
export const describe = 'Import contacts from iCarol csv export(s)';
export const builder = {
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
    alias: 'accountSid',
    describe: 'account SID',
    demandOption: true,
    type: 'string',
  },
  l: {
    alias: 'location',
    describe: 'location of CSV file formatted as an S3 URI',
    demandOption: true,
    type: 'string',
  },
};

/**
 * Builds an in-memory lookup of Twilio worker full name -> worker SID for the
 * given account, so imported iCarol contacts can be attributed to the counsellor
 * recorded in the "PhoneWorkerName" column.
 *
 * Modelled on the Flex `populateCounselors` lambda: it lists the workers in the
 * account's TaskRouter workspace and reads each worker's `full_name` attribute.
 * The Twilio auth token and workspace SID are read from our SSM parameter store.
 */
const buildWorkerSidMap = async ({
  environment,
  accountSid,
}: {
  environment: string;
  accountSid: HrmAccountId;
}): Promise<WorkerSidsByName> => {
  const authToken = await getSsmParameter(
    `/${environment}/twilio/${accountSid}/auth_token`,
  );
  const workspaceSid = await getSsmParameter(
    `/${environment}/twilio/${accountSid}/workspace_sid`,
  );

  const client = await getClient({ accountSid, authToken });
  const workers = await client.taskrouter.workspaces(workspaceSid).workers.list();

  const workerSidsByName: WorkerSidsByName = new Map();
  for (const worker of workers) {
    try {
      const { full_name: fullName } = JSON.parse(worker.attributes ?? '{}');
      if (typeof fullName === 'string' && fullName.trim()) {
        workerSidsByName.set(fullName.trim(), worker.sid as WorkerSID);
      }
    } catch (err) {
      console.warn(
        `Could not parse attributes for worker ${worker.sid}`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }
  return workerSidsByName;
};

export const handler = async ({ region, environment, accountSid, location }) => {
  try {
    const timestamp = new Date().getTime();
    const assumeRoleParams = {
      RoleArn: 'arn:aws:iam::712893914485:role/tf-admin',
      RoleSessionName: `hrm-admin-cli-${timestamp}`,
    };

    const { authKey, internalResourcesUrl } = await getHRMInternalEndpointAccess({
      region,
      environment,
      assumeRoleParams,
    });

    const url = getAdminV0URL(internalResourcesUrl, accountSid, '/contacts');

    // Look up the account's Twilio workers so contacts can be attributed to the
    // counsellor named in the iCarol "PhoneWorkerName" column.
    const workerSidsByName = await buildWorkerSidMap({
      environment,
      accountSid: accountSid as HrmAccountId,
    });

    // Load the CSV file from S3 and parse it into typed record objects.
    // iCarol exports prefix the CSV with a title row and a blank row before the
    // header row, so parsing begins at line 3.
    const { bucket, key } = parseS3Uri(location);
    const csvContent = await getS3Object({
      bucket,
      key,
      responseContentType: 'text/csv',
    });
    const csvRecords: ICarolContactRecord[] = parse(csvContent, {
      columns: true,
      from_line: 3,
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true,
    });

    for (const csvRecord of csvRecords) {
      const workerName = (csvRecord.PhoneWorkerName ?? '').trim();
      if (workerName && !workerSidsByName.has(workerName)) {
        console.warn(
          `No Twilio worker found for PhoneWorkerName "${workerName}" (call report ${csvRecord.CallReportNum}); contact will not be attributed to a worker`,
        );
      }
      const contact = mapContact(csvRecord, workerSidsByName);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${authKey}`,
        },
        body: JSON.stringify(contact),
      });
      if (!response.ok) {
        console.error(
          `Failed to submit request for call report ${csvRecord.CallReportNum} (status: ${
            response.statusText
          }): ${await response.text()}`,
        );
      }
    }

    console.info(`Imported ${csvRecords.length} contact(s) from ${location}`);
  } catch (err) {
    console.error(
      `Failed to import contacts from ${location} into account ${accountSid} (${region} ${environment})`,
      err instanceof Error ? err.message : String(err),
    );
  }
};

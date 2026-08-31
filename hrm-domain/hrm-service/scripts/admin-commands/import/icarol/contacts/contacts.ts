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
  buildLegacyWorkerSid,
  ICarolContactRecord,
  mapContact,
  parseS3Uri,
  registerSyntheticWorker,
  resolveWorkerSid,
  SyntheticWorkerRegistry,
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
  f: {
    alias: 'fallback-worker-sid',
    describe: 'Twilio worker SID to use when PhoneWorkerName is blank',
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
        `Could not parse worker attributes JSON for worker ${worker.sid}`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }
  return workerSidsByName;
};

export const handler = async ({
  region,
  environment,
  accountSid,
  location,
  fallbackWorkerSid,
}) => {
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

    // A repeat submission for the same taskId returns the existing contact
    // instead of creating a duplicate; new-vs-already-imported is inferred by
    // comparing each contact's createdAt to when this run started.
    // No lookup-by-taskId endpoint was added for this: it would give the admin
    // key read access to arbitrary existing contact data, which isn't needed
    // since duplicate handling is already covered server-side.
    const CLOCK_SKEW_BUFFER_MS = 10_000;
    const runStartedAt = new Date(Date.now() - CLOCK_SKEW_BUFFER_MS);
    let newCount = 0;
    let alreadyImportedCount = 0;
    let failedCount = 0;

    // A name that doesn't resolve to a real Twilio worker gets its own
    // synthetic ID rather than sharing one placeholder with every other
    // unmatched name; this tracks which name each synthetic ID belongs to,
    // so a sanitisation collision between two different names is caught
    // rather than silently merged.
    const legacyWorkerRegistry: SyntheticWorkerRegistry = new Map();

    for (const csvRecord of csvRecords) {
      const workerName = (csvRecord.PhoneWorkerName ?? '').trim();
      const resolvedWorkerSid = workerName
        ? resolveWorkerSid(csvRecord, workerSidsByName)
        : undefined;

      let workerSid: WorkerSID;
      if (resolvedWorkerSid) {
        workerSid = resolvedWorkerSid;
      } else if (workerName) {
        // Present but unmatched, even after the conservative normalised
        // match in resolveWorkerSid: attribute to a synthetic per-name ID
        // instead of the single shared fallback.
        const sanitizedId = buildLegacyWorkerSid(workerName);
        workerSid = sanitizedId;
        const result = registerSyntheticWorker(
          legacyWorkerRegistry,
          sanitizedId,
          workerName,
        );
        if (result.status === 'new') {
          console.warn(
            `No Twilio worker found for PhoneWorkerName "${workerName}" (call report ${csvRecord.CallReportNum}); attributing to synthetic worker ${sanitizedId}`,
          );
        } else if (result.status === 'collision') {
          console.warn(
            `Synthetic worker ID ${sanitizedId} collides for two different names: "${result.previousName}" and "${workerName}" (call report ${csvRecord.CallReportNum})`,
          );
        }
      } else {
        // No name recorded at all: nothing to build a synthetic ID from.
        workerSid = fallbackWorkerSid as WorkerSID;
      }

      const contact = mapContact(csvRecord, workerSid);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${authKey}`,
        },
        body: JSON.stringify(contact),
      });
      if (!response.ok) {
        failedCount++;
        console.error(
          `Failed to submit request for call report ${csvRecord.CallReportNum} (status: ${
            response.statusText
          }): ${await response.text()}`,
        );
        continue;
      }

      const createdContact = await response.json();
      if (new Date(createdContact.createdAt) >= runStartedAt) {
        newCount++;
      } else {
        alreadyImportedCount++;
      }
    }

    console.info(
      `Imported ${newCount} new contact(s), skipped ${alreadyImportedCount} already-imported, ${failedCount} failed, out of ${csvRecords.length} total from ${location}`,
    );
  } catch (err) {
    console.error(
      `Failed to import contacts from ${location} into account ${accountSid} (${region} ${environment})`,
      err instanceof Error ? err.message : String(err),
    );
  }
};

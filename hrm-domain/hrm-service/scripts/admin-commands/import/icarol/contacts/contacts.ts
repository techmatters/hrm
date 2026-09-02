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
import { getS3Object, putS3Object } from '@tech-matters/s3-client';
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
import {
  findUnknownColumns,
  findUnknownValueTokens,
  formatValueWarnings,
  recordUnknownValue,
  ValueWarningRegistry,
} from './fieldValidation';
import {
  KNOWN_CALL_REPORT_COLUMNS,
  KNOWN_FIELD_VALUES,
  MULTISELECT_VALUE_FIELDS,
} from './usncFieldRegistry';
import {
  AuditLogEntry,
  buildAuditLogEntry,
  buildRunId,
  formatAuditLogLines,
} from './runAudit';

// Only one config exists so far; this lets a future migration point at its
// own registry without an entry-point code change.
const SUPPORTED_MIGRATION_CONFIGS = ['usnc'];

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
  m: {
    alias: 'migration-config',
    describe: 'Which field/value registry to validate against',
    default: 'usnc',
    type: 'string',
  },
  'run-id': {
    describe:
      'Identifier for this run, used to name the audit log. Auto-generated if omitted.',
    type: 'string',
  },
  d: {
    alias: 'dry-run',
    describe: 'Validate and map records without creating contacts',
    default: false,
    type: 'boolean',
  },
  'skip-reindex': {
    describe: 'Do not trigger an Elasticsearch reindex after this run',
    default: false,
    type: 'boolean',
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
  migrationConfig,
  runId: providedRunId,
  dryRun,
  skipReindex,
}) => {
  // Only validates against a one-item allowlist for now; doesn't yet
  // dispatch to a different registry per config.
  if (!SUPPORTED_MIGRATION_CONFIGS.includes(migrationConfig)) {
    throw new Error(
      `Unsupported migration config "${migrationConfig}"; supported: ${SUPPORTED_MIGRATION_CONFIGS.join(
        ', ',
      )}`,
    );
  }

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

    // For attributing contacts to the counsellor named in "PhoneWorkerName".
    const workerSidsByName = await buildWorkerSidMap({
      environment,
      accountSid: accountSid as HrmAccountId,
    });

    // iCarol exports prefix a title row and a blank row, so parsing begins at line 3.
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

    // Schema-drift check: warn about any column this registry hasn't classified.
    if (csvRecords.length > 0) {
      const unknownColumns = findUnknownColumns(
        Object.keys(csvRecords[0]),
        KNOWN_CALL_REPORT_COLUMNS,
      );
      if (unknownColumns.length > 0) {
        console.warn(
          `Unclassified column(s) in this export: ${unknownColumns.join(', ')}`,
        );
      }
    }
    const valueWarnings: ValueWarningRegistry = new Map();

    // A repeat submission returns the existing contact; new-vs-already-imported
    // is inferred by comparing createdAt to when this run started. No separate
    // lookup-by-taskId check: the server's unique constraint already dedupes.
    const CLOCK_SKEW_BUFFER_MS = 10_000;
    const runStartedAt = new Date(Date.now() - CLOCK_SKEW_BUFFER_MS);
    const runId = providedRunId || buildRunId(runStartedAt);
    let newCount = 0;
    let alreadyImportedCount = 0;
    let failedCount = 0;
    let wouldImportCount = 0;
    const auditLogEntries: AuditLogEntry[] = [];

    // Tracks which name each synthetic worker ID belongs to, to catch collisions.
    const legacyWorkerRegistry: SyntheticWorkerRegistry = new Map();

    for (const csvRecord of csvRecords) {
      const workerName = (csvRecord.PhoneWorkerName ?? '').trim();
      const resolvedWorkerSid = workerName
        ? resolveWorkerSid(csvRecord, workerSidsByName)
        : undefined;

      let workerSid: WorkerSID;
      let usedSyntheticWorker = false;
      if (resolvedWorkerSid) {
        workerSid = resolvedWorkerSid;
      } else if (workerName) {
        // Present but unmatched: attribute to a synthetic per-name ID instead.
        const sanitizedId = buildLegacyWorkerSid(workerName);
        workerSid = sanitizedId;
        usedSyntheticWorker = true;
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

      const recordValueWarnings: string[] = [];
      for (const field of Object.keys(KNOWN_FIELD_VALUES)) {
        const rawValue = (csvRecord[field] ?? '').trim();
        if (!rawValue) continue;
        for (const unknownToken of findUnknownValueTokens(
          field,
          rawValue,
          KNOWN_FIELD_VALUES,
          MULTISELECT_VALUE_FIELDS,
        )) {
          recordUnknownValue(valueWarnings, field, unknownToken, csvRecord.CallReportNum);
          recordValueWarnings.push(`${field}: ${unknownToken}`);
        }
      }

      const contact = mapContact(csvRecord, workerSid);

      if (dryRun) {
        wouldImportCount++;
        auditLogEntries.push(
          buildAuditLogEntry({
            runId,
            callReportNum: csvRecord.CallReportNum,
            timestamp: new Date(),
            outcome: 'dry-run',
            valueWarnings: recordValueWarnings,
          }),
        );
        continue;
      }

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
        // No submitted field values ever appear in this error body (no schema
        // validator on this path; DB error detail is never surfaced), except
        // stack traces if INCLUDE_ERROR_IN_RESPONSE=true on the target env.
        const failureReason = `HTTP ${response.status} ${
          response.statusText
        }: ${await response.text()}`;
        console.error(
          `Failed to submit request for call report ${csvRecord.CallReportNum}: ${failureReason}`,
        );
        auditLogEntries.push(
          buildAuditLogEntry({
            runId,
            callReportNum: csvRecord.CallReportNum,
            timestamp: new Date(),
            outcome: 'failed',
            failureReason,
            valueWarnings: recordValueWarnings,
            usedSyntheticWorker,
          }),
        );
        continue;
      }

      const createdContact = await response.json();
      const isNew = new Date(createdContact.createdAt) >= runStartedAt;
      if (isNew) {
        newCount++;
      } else {
        alreadyImportedCount++;
      }
      auditLogEntries.push(
        buildAuditLogEntry({
          runId,
          callReportNum: csvRecord.CallReportNum,
          timestamp: new Date(),
          outcome: isNew ? 'created' : 'already-imported',
          valueWarnings: recordValueWarnings,
          usedSyntheticWorker,
        }),
      );
    }
    const runEndedAt = new Date();

    if (dryRun) {
      console.info(
        `DRY RUN: would attempt ${wouldImportCount} contact(s), out of ${csvRecords.length} total from ${location}. No contacts were created.`,
      );
    } else {
      console.info(
        `Imported ${newCount} new contact(s), skipped ${alreadyImportedCount} already-imported, ${failedCount} failed, out of ${csvRecords.length} total from ${location}`,
      );
    }
    formatValueWarnings(valueWarnings).forEach(warning => console.warn(warning));

    // Written for dry runs too, under a distinct key: the whole point of a
    // dry run is a reviewable artifact of what a real run would do.
    const auditLogKey = `icarol-import-audit-logs/${runId}${
      dryRun ? '-dry-run' : ''
    }.jsonl`;
    try {
      await putS3Object({
        bucket,
        key: auditLogKey,
        body: formatAuditLogLines(auditLogEntries),
        contentType: 'application/x-ndjson',
      });
      console.info(`Audit log written to s3://${bucket}/${auditLogKey}`);
    } catch (err) {
      console.error(
        `Failed to write audit log to s3://${bucket}/${auditLogKey}`,
        err instanceof Error ? err.message : String(err),
      );
    }

    if (dryRun) {
      return;
    }

    if (skipReindex) {
      console.info('Skipping reindex (--skip-reindex).');
    } else if (newCount > 0) {
      const reindexUrl = getAdminV0URL(
        internalResourcesUrl,
        accountSid,
        '/contacts/reindex',
      );
      try {
        const reindexResponse = await fetch(reindexUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${authKey}`,
          },
          body: JSON.stringify({
            dateFrom: runStartedAt.toISOString(),
            dateTo: runEndedAt.toISOString(),
          }),
        });
        if (!reindexResponse.ok) {
          console.error(
            `Reindex request failed (status: ${
              reindexResponse.statusText
            }): ${await reindexResponse.text()}`,
          );
        } else {
          console.info(`Requested a reindex of run ${runId}'s new contacts.`);
        }
      } catch (err) {
        console.error(
          `Failed to request a reindex of run ${runId}'s new contacts`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }
  } catch (err) {
    console.error(
      `Failed to import contacts from ${location} into account ${accountSid} (${region} ${environment})`,
      err instanceof Error ? err.message : String(err),
    );
  }
};

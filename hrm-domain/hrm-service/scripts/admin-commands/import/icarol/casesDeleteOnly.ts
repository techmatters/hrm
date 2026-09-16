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
import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getHRMInternalEndpointAccess } from '@tech-matters/service-discovery';
import { parseS3Uri } from './contacts/contactMapper';
import {
  CaseStillLinkedError,
  deleteCaseById,
  getCaseById,
  getContactById,
  looksUntouchedSinceImport,
} from './cases/clearDownApi';
import {
  AuditLogEntry,
  buildAuditLogEntry,
  buildRunId,
  formatAuditLogLines,
  ICAROL_CASES_CLEARDOWN_AUDIT_LOG_PREFIX,
} from './contacts/runAudit';

// Step 2 of clear-down. The only targeting input is --unlink-run-id;
// everything it acts on comes from step 1's audit log.
export const command = 'cases-delete-only';
export const describe =
  'Clear-down step 2: delete Cases already emptied by a specific cases-unlink-only run.';
export const MAX_BATCH_SIZE = 100;

export const builder = {
  e: { alias: 'environment', demandOption: true, type: 'string' },
  r: { alias: 'region', demandOption: true, type: 'string' },
  a: { alias: 'accountSid', demandOption: true, type: 'string' },
  location: {
    describe: 'S3 URI of the bucket holding the cases-cleardown audit logs',
    demandOption: true,
    type: 'string',
  },
  'unlink-run-id': {
    describe: 'The cases-unlink-only run whose emptied Cases should now be deleted',
    demandOption: true,
    type: 'string',
  },
  operator: {
    describe: 'Real identity of the person running this, recorded in the audit log',
    demandOption: true,
    type: 'string',
  },
  'confirm-count': {
    describe:
      "Must exactly equal the unlink run's entry count. Forces the operator to look before deleting.",
    demandOption: true,
    type: 'number',
  },
  'run-id': {
    describe: 'Identifier for this delete run. Auto-generated if omitted.',
    type: 'string',
  },
  d: {
    alias: 'dry-run',
    describe: 'Report what would be deleted without deleting anything',
    default: false,
    type: 'boolean',
  },
};

const assumeRoleCredentials = async (
  region: string,
  assumeRoleParams: { RoleArn: string; RoleSessionName: string },
) => {
  const sts = new STSClient({ region });
  const { Credentials } = await sts.send(new AssumeRoleCommand(assumeRoleParams));
  return {
    accessKeyId: Credentials!.AccessKeyId!,
    secretAccessKey: Credentials!.SecretAccessKey!,
    sessionToken: Credentials!.SessionToken!,
  };
};

export const handler = async ({
  region,
  environment,
  accountSid,
  location,
  unlinkRunId,
  operator,
  confirmCount,
  runId: providedRunId,
  dryRun,
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
    const auth = { internalResourcesUrl, accountSid, authKey };

    const { bucket } = parseS3Uri(location);
    const s3 = new S3Client({
      region,
      credentials: await assumeRoleCredentials(region, assumeRoleParams),
    });

    const unlinkLogKey = `${ICAROL_CASES_CLEARDOWN_AUDIT_LOG_PREFIX}${unlinkRunId}-unlink.jsonl`;
    const unlinkLogBody = await (
      await s3.send(new GetObjectCommand({ Bucket: bucket, Key: unlinkLogKey }))
    ).Body!.transformToString();

    // Accepts both outcomes: a re-run of unlink-only reports a case that's
    // already empty as 'already-unlinked', not 'unlinked', even though it's
    // just as safe to delete. Excluding it would strand those cases.
    const unlinkedEntries: AuditLogEntry[] = unlinkLogBody
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line))
      .filter(
        (entry: AuditLogEntry) =>
          (entry.outcome === 'unlinked' || entry.outcome === 'already-unlinked') &&
          entry.caseId,
      );

    console.info(
      `Unlink run ${unlinkRunId} has ${unlinkedEntries.length} case(s) to delete.`,
    );

    if (confirmCount !== unlinkedEntries.length) {
      throw new Error(
        `--confirm-count ${confirmCount} does not match the ${unlinkedEntries.length} entries in unlink run ${unlinkRunId}. Refusing to proceed -- re-check the unlink run's audit log before retrying.`,
      );
    }

    if (unlinkedEntries.length > MAX_BATCH_SIZE) {
      throw new Error(
        `${unlinkedEntries.length} cases exceeds the safety cap of ${MAX_BATCH_SIZE} for a single delete-only run. Split the unlink run's audit log into smaller files and run this against each one separately.`,
      );
    }

    const runId = providedRunId || buildRunId(new Date());
    const auditLogKey = `${ICAROL_CASES_CLEARDOWN_AUDIT_LOG_PREFIX}${runId}-delete${
      dryRun ? '-dry-run' : ''
    }.jsonl`;
    const auditLogEntries: AuditLogEntry[] = [];
    let deletedCount = 0;
    let skippedCount = 0;
    let alreadyDeletedCount = 0;
    let failedCount = 0;

    // Rewrites the whole log after every case, so a crash mid-run loses at
    // most the one entry in flight, not the entire run's record.
    const persistAuditLog = async (): Promise<boolean> => {
      try {
        await s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: auditLogKey,
            Body: formatAuditLogLines(auditLogEntries),
            ContentType: 'application/x-ndjson',
          }),
        );
        return true;
      } catch (err) {
        console.error(
          `Failed to write delete audit log to s3://${bucket}/${auditLogKey}`,
          err instanceof Error ? err.message : String(err),
        );
        return false;
      }
    };

    let aborted = false;

    for (const entry of unlinkedEntries) {
      const { caseId, callerNums = [], contactIds = [] } = entry;

      try {
        const liveCase = await getCaseById(auth, caseId!);
        if (!liveCase) {
          alreadyDeletedCount++;
          // Read-only outcome, nothing mutated: no need for immediate durability.
          auditLogEntries.push(
            buildAuditLogEntry({
              runId,
              timestamp: new Date(),
              outcome: 'already-deleted',
              callerNums,
              caseId,
              contactIds,
              reason: 'already deleted, no-op',
            }),
          );
          continue;
        }

        if (!looksUntouchedSinceImport(liveCase)) {
          skippedCount++;
          auditLogEntries.push(
            buildAuditLogEntry({
              runId,
              timestamp: new Date(),
              outcome: 'skipped-changed-since-unlink',
              callerNums,
              caseId,
              contactIds,
              reason: 'case has changed since the unlink pass; needs manual review',
            }),
          );
          continue;
        }

        let stillLinked = false;
        for (const contactId of contactIds ?? []) {
          const contact = await getContactById(auth, contactId);
          if (contact.caseId === caseId) {
            stillLinked = true;
            break;
          }
        }
        if (stillLinked) {
          skippedCount++;
          auditLogEntries.push(
            buildAuditLogEntry({
              runId,
              timestamp: new Date(),
              outcome: 'skipped-changed-since-unlink',
              callerNums,
              caseId,
              contactIds,
              reason: 'a contact has been re-linked to this case since the unlink pass',
            }),
          );
          continue;
        }

        if (!dryRun) {
          try {
            await deleteCaseById(auth, caseId!);
          } catch (err) {
            if (err instanceof CaseStillLinkedError) {
              skippedCount++;
              // The delete was rejected server-side: nothing was mutated.
              auditLogEntries.push(
                buildAuditLogEntry({
                  runId,
                  timestamp: new Date(),
                  outcome: 'skipped-changed-since-unlink',
                  callerNums,
                  caseId,
                  contactIds,
                  reason: 'a contact was linked to this case just before deletion',
                }),
              );
              continue;
            }
            throw err;
          }
        }
        deletedCount++;
        // No-PII structural snapshot only: never label/linkedProfileName/summary.
        auditLogEntries.push(
          buildAuditLogEntry({
            runId,
            timestamp: new Date(),
            outcome: dryRun ? 'dry-run' : 'deleted',
            callerNums,
            caseId,
            contactIds,
            reason: `deleted by ${operator}, from unlink run ${unlinkRunId}`,
          }),
        );
        // Only a real delete needs immediate durability; a dry run mutated nothing.
        if (!dryRun && !(await persistAuditLog())) {
          aborted = true;
          break;
        }
      } catch (err) {
        failedCount++;
        const failureReason = err instanceof Error ? err.message : String(err);
        console.error(`Failed to delete case ${caseId}: ${failureReason}`);
        auditLogEntries.push(
          buildAuditLogEntry({
            runId,
            timestamp: new Date(),
            outcome: 'failed',
            callerNums,
            caseId,
            contactIds,
            failureReason,
          }),
        );
        // The delete call's outcome may be ambiguous (e.g. a timeout after
        // the server actually committed it), so this still needs the same
        // durability guarantee.
        if (!(await persistAuditLog())) {
          aborted = true;
          break;
        }
      }
    }

    console.info(
      `Delete: ${deletedCount} deleted, ${alreadyDeletedCount} already deleted, ${skippedCount} skipped, ${failedCount} failed, out of ${unlinkedEntries.length} from unlink run ${unlinkRunId}.`,
    );

    if (aborted) {
      console.error(
        `Aborting: could not persist the delete audit log to s3://${bucket}/${auditLogKey}. Stopping to avoid further unrecorded mutations.`,
      );
      process.exitCode = 1;
    } else if (await persistAuditLog()) {
      console.info(`Delete audit log written to s3://${bucket}/${auditLogKey}`);
    }
  } catch (err) {
    console.error(
      `Failed to run delete-only for account ${accountSid} (${region} ${environment})`,
      err instanceof Error ? err.message : String(err),
    );
    process.exitCode = 1;
  }
};

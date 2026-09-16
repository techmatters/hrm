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
  getCaseById,
  getContactById,
  looksUntouchedSinceImport,
  unlinkContactFromCase,
} from './cases/clearDownApi';
import {
  AuditLogEntry,
  buildAuditLogEntry,
  buildRunId,
  formatAuditLogLines,
  ICAROL_CASES_AUDIT_LOG_PREFIX,
  ICAROL_CASES_CLEARDOWN_AUDIT_LOG_PREFIX,
} from './contacts/runAudit';

// Step 1 of clear-down: unlinks Contacts, never deletes a Case. Step 2
// (cases-delete-only) reads the run's audit log to decide what to delete.
export const command = 'cases-unlink-only';
export const describe =
  'Clear-down step 1: unlink Contacts from Cases created by a specific cases run. Never deletes a Case.';
export const builder = {
  e: { alias: 'environment', demandOption: true, type: 'string' },
  r: { alias: 'region', demandOption: true, type: 'string' },
  a: { alias: 'accountSid', demandOption: true, type: 'string' },
  location: {
    describe: 'S3 URI of the bucket holding the cases-import audit logs',
    demandOption: true,
    type: 'string',
  },
  'target-run-id': {
    describe: 'The cases-import run to undo (reads its audit log to find what to unlink)',
    demandOption: true,
    type: 'string',
  },
  'run-id': {
    describe: 'Identifier for this unlink run. Auto-generated if omitted.',
    type: 'string',
  },
  d: {
    alias: 'dry-run',
    describe: 'Report what would be unlinked without unlinking anything',
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
  targetRunId,
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

    const targetLogKey = `${ICAROL_CASES_AUDIT_LOG_PREFIX}${targetRunId}.jsonl`;
    const targetLogBody = await (
      await s3.send(new GetObjectCommand({ Bucket: bucket, Key: targetLogKey }))
    ).Body!.transformToString();

    const createdEntries: AuditLogEntry[] = targetLogBody
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line))
      .filter((entry: AuditLogEntry) => entry.outcome === 'created' && entry.caseId);

    const runId = providedRunId || buildRunId(new Date());
    const auditLogKey = `${ICAROL_CASES_CLEARDOWN_AUDIT_LOG_PREFIX}${runId}-unlink${
      dryRun ? '-dry-run' : ''
    }.jsonl`;
    const auditLogEntries: AuditLogEntry[] = [];
    let unlinkedCount = 0;
    let alreadyUnlinkedCount = 0;
    let skippedCount = 0;
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
          `Failed to write unlink audit log to s3://${bucket}/${auditLogKey}`,
          err instanceof Error ? err.message : String(err),
        );
        return false;
      }
    };

    let aborted = false;

    for (const entry of createdEntries) {
      const { caseId, callerNums = [], contactIds = [] } = entry;

      try {
        const liveCase = await getCaseById(auth, caseId!);
        if (!liveCase) {
          alreadyUnlinkedCount++;
          // Read-only outcome, nothing mutated: no need for immediate durability.
          auditLogEntries.push(
            buildAuditLogEntry({
              runId,
              timestamp: new Date(),
              outcome: 'already-unlinked',
              callerNums,
              caseId,
              contactIds,
              reason: 'case no longer exists',
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
              outcome: 'skipped-touched',
              callerNums,
              caseId,
              contactIds,
              reason:
                'case has been edited or has sections since import; needs manual review',
            }),
          );
          continue;
        }

        let anyUnlinked = false;
        for (const contactId of contactIds ?? []) {
          const contact = await getContactById(auth, contactId);
          if (contact.caseId !== caseId) continue; // already unlinked or reassigned

          anyUnlinked = true;
          if (!dryRun) {
            await unlinkContactFromCase(auth, contactId);
          }
        }

        const mutated = anyUnlinked && !dryRun;
        if (anyUnlinked) {
          unlinkedCount++;
          auditLogEntries.push(
            buildAuditLogEntry({
              runId,
              timestamp: new Date(),
              outcome: dryRun ? 'dry-run' : 'unlinked',
              callerNums,
              caseId,
              contactIds,
            }),
          );
        } else {
          alreadyUnlinkedCount++;
          auditLogEntries.push(
            buildAuditLogEntry({
              runId,
              timestamp: new Date(),
              outcome: 'already-unlinked',
              callerNums,
              caseId,
              contactIds,
            }),
          );
        }
        // Only a real unlink needs immediate durability; a dry run or a
        // no-op found nothing to lose.
        if (mutated && !(await persistAuditLog())) {
          aborted = true;
          break;
        }
      } catch (err) {
        failedCount++;
        const failureReason = err instanceof Error ? err.message : String(err);
        console.error(`Failed to unlink case ${caseId}: ${failureReason}`);
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
        // The per-contact loop above may have unlinked some contacts before
        // hitting the error, so this still needs the same durability guarantee.
        if (!(await persistAuditLog())) {
          aborted = true;
          break;
        }
      }
    }

    console.info(
      `Unlink: ${unlinkedCount} unlinked, ${alreadyUnlinkedCount} already unlinked, ${skippedCount} skipped, ${failedCount} failed, out of ${createdEntries.length} cases from run ${targetRunId}.`,
    );

    if (aborted) {
      console.error(
        `Aborting: could not persist the unlink audit log to s3://${bucket}/${auditLogKey}. Stopping to avoid further unrecorded mutations.`,
      );
      process.exitCode = 1;
    } else if (await persistAuditLog()) {
      console.info(`Unlink audit log written to s3://${bucket}/${auditLogKey}`);
    }
  } catch (err) {
    console.error(
      `Failed to run unlink-only for account ${accountSid} (${region} ${environment})`,
      err instanceof Error ? err.message : String(err),
    );
    process.exitCode = 1;
  }
};

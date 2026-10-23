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
import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts';
import {
  S3Client,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getHRMInternalEndpointAccess } from '@tech-matters/service-discovery';
import { getAdminV0URL } from '../../../hrmInternalConfig';
import { parseS3Uri } from './contacts/contactMapper';
import {
  buildCaseCandidates,
  ICarolCallReportRecord,
  ICarolRepeatCallerRecord,
} from './cases/caseIdentityResolution';
import { mapCase } from './cases/caseMapper';
import { getCaseById, getContactById, wasCreatedByImport } from './cases/clearDownApi';
import {
  AuditLogEntry,
  buildAuditLogEntry,
  buildRunId,
  formatAuditLogLines,
  ICAROL_CASES_AUDIT_LOG_PREFIX,
  ICAROL_IMPORT_AUDIT_LOG_PREFIX,
} from './contacts/runAudit';

export const command = 'cases';
export const describe = 'Create Aselo Cases for repeat callers from iCarol csv export(s)';
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
  'call-reports-location': {
    describe: 'Location of the Call Reports CSV file, formatted as an S3 URI',
    demandOption: true,
    type: 'string',
  },
  'repeat-callers-location': {
    describe: 'Location of the Repeat Callers CSV file, formatted as an S3 URI',
    demandOption: true,
    type: 'string',
  },
  'run-id': {
    describe:
      'Identifier for this run, used to name the audit log. Auto-generated if omitted.',
    type: 'string',
  },
  d: {
    alias: 'dry-run',
    describe: 'Resolve candidates without creating or connecting cases',
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

/**
 * Every taskId to real Contact id ever imported, built from every prior
 * contacts-import audit log (dry-run excluded). Stays valid across a
 * clear-down, since that only unlinks Contacts and never deletes them.
 */
const buildContactIdByTaskId = async (
  s3: S3Client,
  bucket: string,
): Promise<Map<string, string>> => {
  const contactIdByTaskId = new Map<string, string>();
  const { Contents = [] } = await s3.send(
    new ListObjectsV2Command({ Bucket: bucket, Prefix: ICAROL_IMPORT_AUDIT_LOG_PREFIX }),
  );

  for (const object of Contents) {
    if (!object.Key || object.Key.endsWith('-dry-run.jsonl')) continue;
    const body = await (
      await s3.send(new GetObjectCommand({ Bucket: bucket, Key: object.Key }))
    ).Body!.transformToString();

    for (const line of body.split('\n')) {
      if (!line.trim()) continue;
      const entry = JSON.parse(line) as AuditLogEntry;
      if (entry.callReportNum && entry.contactId) {
        contactIdByTaskId.set(`TK_legacy_${entry.callReportNum}`, entry.contactId);
      }
    }
  }
  return contactIdByTaskId;
};

export const handler = async ({
  region,
  environment,
  accountSid,
  callReportsLocation,
  repeatCallersLocation,
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

    const casesUrl = getAdminV0URL(internalResourcesUrl, accountSid, '/cases');
    const s3 = new S3Client({
      region,
      credentials: await assumeRoleCredentials(region, assumeRoleParams),
    });

    // iCarol exports prefix a title row and a blank row, so parsing begins at line 3.
    const readCsv = async <T>(
      location: string,
    ): Promise<{ bucket: string; records: T[] }> => {
      const { bucket, key } = parseS3Uri(location);
      const content = await (
        await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
      ).Body!.transformToString();
      return {
        bucket,
        records: parse(content, {
          columns: true,
          from_line: 3,
          skip_empty_lines: true,
          relax_column_count: true,
          trim: true,
        }),
      };
    };

    const { bucket, records: callReports } =
      await readCsv<ICarolCallReportRecord>(callReportsLocation);
    const { records: repeatCallers } =
      await readCsv<ICarolRepeatCallerRecord>(repeatCallersLocation);

    const contactIdByTaskId = await buildContactIdByTaskId(s3, bucket);
    const candidates = buildCaseCandidates(callReports, repeatCallers);

    const runId = providedRunId || buildRunId(new Date());
    const auditLogKey = `${ICAROL_CASES_AUDIT_LOG_PREFIX}${runId}${
      dryRun ? '-dry-run' : ''
    }.jsonl`;
    const auditLogEntries: AuditLogEntry[] = [];
    let createdCount = 0;
    let alreadyImportedCount = 0;
    let deferredCount = 0;
    let failedCount = 0;

    // Rewrites the whole log after every candidate, so a crash mid-run
    // loses at most the one entry in flight, not the entire run's record.
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
          `Failed to write audit log to s3://${bucket}/${auditLogKey}`,
          err instanceof Error ? err.message : String(err),
        );
        return false;
      }
    };

    let aborted = false;

    for (const candidate of candidates) {
      const resolvedContactIds = candidate.contactTaskIds.map(taskId =>
        contactIdByTaskId.get(taskId),
      );
      if (resolvedContactIds.some(contactId => !contactId)) {
        deferredCount++;
        // Nothing was mutated, so there's nothing that needs durability yet.
        auditLogEntries.push(
          buildAuditLogEntry({
            runId,
            timestamp: new Date(),
            outcome: 'deferred',
            callerNums: candidate.callerNums,
            reason: 'not all contacts have been imported yet',
          }),
        );
        continue;
      }
      const contactIds = resolvedContactIds as string[];

      if (dryRun) {
        auditLogEntries.push(
          buildAuditLogEntry({
            runId,
            timestamp: new Date(),
            outcome: 'dry-run',
            callerNums: candidate.callerNums,
            contactIds,
          }),
        );
        continue;
      }

      try {
        const firstContact = await getContactById(
          { internalResourcesUrl, accountSid, authKey },
          contactIds[0],
        );

        const alreadyExisted = Boolean(firstContact.caseId);
        let caseId = firstContact.caseId;
        if (alreadyExisted) {
          const existingCase = await getCaseById(
            { internalResourcesUrl, accountSid, authKey },
            caseId!,
          );
          if (!existingCase || !wasCreatedByImport(existingCase)) {
            throw new Error(
              `Contact ${contactIds[0]} is already linked to case ${caseId}, which wasn't created by this import; skipping to avoid touching a counsellor's case`,
            );
          }
          alreadyImportedCount++;
        } else {
          const createResponse = await fetch(casesUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Basic ${authKey}`,
            },
            body: JSON.stringify(mapCase(candidate)),
          });
          if (!createResponse.ok) {
            throw new Error(
              `Failed to create case: HTTP ${createResponse.status} ${
                createResponse.statusText
              }: ${await createResponse.text()}`,
            );
          }
          const createdCase = await createResponse.json();
          caseId = createdCase.id;
          createdCount++;
        }

        for (const contactId of contactIds) {
          const connectUrl = getAdminV0URL(
            internalResourcesUrl,
            accountSid,
            `/contacts/${contactId}/connectToCase`,
          );
          const connectResponse = await fetch(connectUrl, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Basic ${authKey}`,
            },
            body: JSON.stringify({ caseId }),
          });
          if (!connectResponse.ok) {
            throw new Error(
              `Failed to connect contact ${contactId} to case ${caseId}: HTTP ${
                connectResponse.status
              } ${connectResponse.statusText}: ${await connectResponse.text()}`,
            );
          }
        }

        auditLogEntries.push(
          buildAuditLogEntry({
            runId,
            timestamp: new Date(),
            outcome: alreadyExisted ? 'already-imported' : 'created',
            callerNums: candidate.callerNums,
            caseId,
            contactIds,
          }),
        );
        // A real mutation just happened. If this can't be persisted, stop
        // rather than keep mutating cases with no durable record of it.
        if (!(await persistAuditLog())) {
          aborted = true;
          break;
        }
      } catch (err) {
        failedCount++;
        const failureReason = err instanceof Error ? err.message : String(err);
        console.error(
          `Failed to process case candidate for CallerNum(s) ${candidate.callerNums.join(
            ', ',
          )}: ${failureReason}`,
        );
        auditLogEntries.push(
          buildAuditLogEntry({
            runId,
            timestamp: new Date(),
            outcome: 'failed',
            callerNums: candidate.callerNums,
            contactIds,
            failureReason,
          }),
        );
        // A partial mutation may have happened before the failure (e.g. the
        // case was created but a contact connect failed), so this still
        // needs the same durability guarantee.
        if (!(await persistAuditLog())) {
          aborted = true;
          break;
        }
      }
    }

    console.info(
      `Cases: ${createdCount} created, ${alreadyImportedCount} already imported, ${deferredCount} deferred (not all contacts imported yet), ${failedCount} failed, out of ${candidates.length} qualifying identities.`,
    );

    if (aborted) {
      console.error(
        `Aborting: could not persist the audit log to s3://${bucket}/${auditLogKey}. Stopping to avoid further unrecorded mutations.`,
      );
      process.exitCode = 1;
    } else if (await persistAuditLog()) {
      console.info(`Audit log written to s3://${bucket}/${auditLogKey}`);
    }
  } catch (err) {
    console.error(
      `Failed to create cases for account ${accountSid} (${region} ${environment})`,
      err instanceof Error ? err.message : String(err),
    );
    process.exitCode = 1;
  }
};

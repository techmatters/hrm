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
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { parseS3Uri } from './contacts/contactMapper';

// Splits the full historical Call Reports export into ordered, fixed-size
// batches for contacts.ts to import one at a time. Doesn't affect cases.ts,
// which always reads the full historical data.
export const command = 'slice-batches';
export const describe =
  'Slice the full historical Call Reports CSV into ordered batch files';
export const builder = {
  r: { alias: 'region', demandOption: true, type: 'string' },
  location: {
    describe: 'S3 URI of the full historical Call Reports CSV',
    demandOption: true,
    type: 'string',
  },
  'output-prefix': {
    describe: 'S3 URI prefix to write batch-NNN.csv files under',
    demandOption: true,
    type: 'string',
  },
  'batch-size': {
    describe: 'Number of rows per batch',
    demandOption: true,
    type: 'number',
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

// Quotes every field, doubling internal quotes.
const toCsvRow = (values: string[]): string =>
  values.map(value => `"${(value ?? '').replace(/"/g, '""')}"`).join(',');

// A malformed date/number yields NaN, and a comparator returning NaN leaves
// Array.prototype.sort's behavior unspecified -- treat it as "no difference"
// here instead, so a later tie-break still runs.
const safeDiff = (a: number, b: number): number =>
  Number.isNaN(a) || Number.isNaN(b) ? 0 : a - b;

/**
 * Orders Call Reports rows deterministically so re-running this always
 * produces identical batches, even with a malformed date or CallReportNum:
 * date, then CallReportNum as a number, then CallReportNum as a string --
 * the last of which never returns NaN, guaranteeing a total order.
 */
export const compareCallReportRows = (
  a: { CallDateAndTimeStart: string; CallReportNum: string },
  b: { CallDateAndTimeStart: string; CallReportNum: string },
): number => {
  const dateDiff = safeDiff(
    new Date(a.CallDateAndTimeStart).getTime(),
    new Date(b.CallDateAndTimeStart).getTime(),
  );
  if (dateDiff !== 0) return dateDiff;

  const numDiff = safeDiff(Number(a.CallReportNum), Number(b.CallReportNum));
  if (numDiff !== 0) return numDiff;

  return a.CallReportNum.localeCompare(b.CallReportNum);
};

export const handler = async ({ region, location, outputPrefix, batchSize }) => {
  try {
    const assumeRoleParams = {
      RoleArn: 'arn:aws:iam::712893914485:role/tf-admin',
      RoleSessionName: `hrm-admin-cli-${Date.now()}`,
    };
    const s3 = new S3Client({
      region,
      credentials: await assumeRoleCredentials(region, assumeRoleParams),
    });

    const { bucket, key } = parseS3Uri(location);
    const content = await (
      await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
    ).Body!.transformToString();

    const header: string[] = parse(content, {
      from_line: 3,
      to_line: 3,
      relax_column_count: true,
    })[0];
    const records: Record<string, string>[] = parse(content, {
      columns: true,
      from_line: 3,
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true,
    });

    // Deterministic order: re-running this always produces identical batches.
    records.sort(compareCallReportRows);

    // The source file's own preamble, copied verbatim -- not hardcoded, so
    // it stays correct if the export's title line ever changes.
    const [titleLine = '', blankLine = ''] = content.split(/\r?\n/, 2);

    const { bucket: outputBucket, key: outputKeyPrefix } = parseS3Uri(outputPrefix);
    const batchCount = Math.ceil(records.length / batchSize);

    for (let batchIndex = 0; batchIndex < batchCount; batchIndex++) {
      const batchRecords = records.slice(
        batchIndex * batchSize,
        (batchIndex + 1) * batchSize,
      );
      const lines = [
        titleLine,
        blankLine,
        toCsvRow(header),
        ...batchRecords.map(record =>
          toCsvRow(header.map(column => record[column] ?? '')),
        ),
      ];

      const paddedIndex = String(batchIndex + 1).padStart(3, '0');
      const batchKey = `${outputKeyPrefix.replace(/\/$/, '')}/batch-${paddedIndex}.csv`;
      await s3.send(
        new PutObjectCommand({
          Bucket: outputBucket,
          Key: batchKey,
          Body: lines.join('\n'),
          ContentType: 'text/csv',
        }),
      );
      console.info(
        `Wrote batch ${paddedIndex} (${batchRecords.length} rows) to s3://${outputBucket}/${batchKey}`,
      );
    }

    console.info(
      `Sliced ${records.length} total rows into ${batchCount} batch(es) of up to ${batchSize} rows each.`,
    );
  } catch (err) {
    console.error(
      `Failed to slice ${location} into batches`,
      err instanceof Error ? err.message : String(err),
    );
  }
};

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
import { getAdminV0URL } from '../../../../hrmInternalConfig';
import { ICarolContactRecord, mapContact, parseS3Uri } from './contactMapper';

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
      const contact = mapContact(csvRecord);
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

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
import type { ContactRawJson, NewContactRecord } from '@tech-matters/hrm-types';
import { getAdminV0URL } from '../../../../hrmInternalConfig';

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
 * Shape of a single row in an iCarol "CallReports" CSV export. The property
 * names match the column headers in the export. Only the columns that are
 * mapped across to an Aselo contact are listed explicitly; the index signature
 * covers the remaining (unmapped) columns.
 */
type ICarolContactRecord = {
  CallReportNum: string;
  CallDateAndTimeStart: string;
  CallDateAndTimeEnd: string;
  CallLength: string;
  CallerName: string;
  PhoneWorkerName: string;
  StateProvince: string;
  CityName: string;
  CountyName: string;
  PhoneNumberFull: string;
  WasRealCall: string;
  WasHangup: string;
  WasSexCall: string;
  WasWrongNumber: string;
  WasPrankCall: string;
  WasSilentCall: string;
  'Call Information - Call Direction': string;
  'Call Information - Call Type': string;
  'Caller Demographics - 988 referral': string;
  'Caller Demographics - Age Range': string;
  'Caller Demographics - Ethnicity': string;
  'Caller Demographics - Gender': string;
  'Caller Demographics - Military Status': string;
  'Caller Demographics - Pronouns': string;
  'Caller Demographics - Race': string;
  'Incoming Call Information - How did you hear about the Warmline?': string;
  'Incoming Call Information - Do you want a call back': string;
  'Incoming Call Information - Have you been directly impacted by substance use?': string;
  'Follow up Outcome - Was the caller satisfied?': string;
  'Non-Crisis Response - Was Caller Satisfied?': string;
  'Referrals - Type of Resource': string;
  'The Eight Dimensions of Wellness - Eight Dimensions of Wellness - Check all that apply': string;
  [column: string]: string;
};

/**
 * Each of the iCarol "eight dimensions of wellness" maps onto a single Aselo
 * category with an "Unspecified/Other" subcategory. Keyed by the (normalised)
 * iCarol dimension name. Mapping taken from the PRN field mapping spreadsheet.
 */
const WELLNESS_CATEGORY_MAP: Record<string, [category: string, subcategory: string]> = {
  'emotional/mental': ['Emotional/Mental', 'Unspecified/Other - EM'],
  environmental: ['Environmental', 'Unspecified/Other - E'],
  financial: ['Financial', 'Unspecified/Other - F'],
  intellectual: ['Intellectual', 'Unspecified/Other - I'],
  occupational: ['Occupational', 'Unspecified/Other - O'],
  physical: ['Physical', 'Unspecified/Other - P'],
  social: ['Social', 'Unspecified/Other - S'],
  spiritual: ['Spiritual', 'Unspecified/Other - SP'],
};

/**
 * iCarol stores yes/no answers as the strings "Yes"/"No". Returns undefined for
 * empty/unrecognised values so the field can be omitted from the contact.
 */
const parseICarolBoolean = (value: string | undefined): boolean | undefined => {
  if (!value) return undefined;
  const normalised = value.trim().toLowerCase();
  if (normalised === 'yes') return true;
  if (normalised === 'no') return false;
  return undefined;
};

/**
 * Parses an S3 URI (e.g. s3://my-bucket/path/to/file.csv) into its bucket & key.
 */
const parseS3Uri = (location: string): { bucket: string; key: string } => {
  const { protocol, hostname, pathname } = new URL(location);
  if (protocol !== 's3:') {
    throw new Error(`location must be an S3 URI (s3://bucket/key), got: ${location}`);
  }
  return { bucket: hostname, key: decodeURIComponent(pathname.replace(/^\//, '')) };
};

/**
 * Builds the Aselo "Categories" structure from the iCarol "Eight Dimensions of
 * Wellness" field, which is a semicolon separated list of dimensions.
 */
const mapCategories = (dimensions: string | undefined): ContactRawJson['categories'] => {
  const categories: ContactRawJson['categories'] = {};
  if (!dimensions) return categories;
  dimensions
    .split(';')
    .map(dimension =>
      dimension
        .replace(/\s*\/\s*/g, '/')
        .trim()
        .toLowerCase(),
    )
    .filter(Boolean)
    .forEach(dimension => {
      const mapping = WELLNESS_CATEGORY_MAP[dimension];
      if (!mapping) return;
      const [category, subcategory] = mapping;
      categories[category] = [...(categories[category] ?? []), subcategory];
    });
  return categories;
};

/**
 * Assigns a value to a form object only when it is a non-empty string/boolean,
 * so that blank iCarol columns don't populate Aselo fields with empty values.
 */
const assignIfPresent = (
  target: Record<string, string | boolean>,
  key: string,
  value: string | boolean | undefined,
) => {
  if (value === undefined || value === '') return;
  target[key] = value;
};

/**
 * Maps a single iCarol CSV record onto the Aselo contact payload. Per the PRN
 * field mapping spreadsheet, the "Contact > Support Seeker" fields are mapped
 * onto rawJson.childInformation and the "Contact > Summary" fields onto
 * rawJson.caseInformation.
 */
const mapContact = (record: ICarolContactRecord): Partial<NewContactRecord> => {
  // Contact > Support Seeker -> rawJson.childInformation
  const childInformation: ContactRawJson['childInformation'] = {};
  assignIfPresent(childInformation, 'name', record.CallerName);
  assignIfPresent(childInformation, 'phone1', record.PhoneNumberFull);
  assignIfPresent(childInformation, 'state', record.StateProvince);
  assignIfPresent(childInformation, 'city', record.CityName);
  assignIfPresent(childInformation, 'county', record.CountyName);
  assignIfPresent(
    childInformation,
    'ageRange',
    record['Caller Demographics - Age Range'],
  );
  assignIfPresent(
    childInformation,
    'ethnicity',
    record['Caller Demographics - Ethnicity'],
  );
  assignIfPresent(childInformation, 'gender', record['Caller Demographics - Gender']);
  assignIfPresent(
    childInformation,
    'militaryStatus',
    record['Caller Demographics - Military Status'],
  );
  assignIfPresent(childInformation, 'pronouns', record['Caller Demographics - Pronouns']);
  assignIfPresent(childInformation, 'race', record['Caller Demographics - Race']);
  assignIfPresent(
    childInformation,
    'referralTo988',
    record['Caller Demographics - 988 referral'],
  );
  assignIfPresent(
    childInformation,
    'howDidYouHearAboutTheWarmLine',
    record['Incoming Call Information - How did you hear about the Warmline?'],
  );

  // Contact > Summary -> rawJson.caseInformation
  const caseInformation: ContactRawJson['caseInformation'] = {};
  // "Was the caller satisfied with the support provided?" is captured in two
  // separate iCarol fields depending on whether it was a crisis call.
  assignIfPresent(
    caseInformation,
    'callerSatisfied',
    parseICarolBoolean(
      record['Follow up Outcome - Was the caller satisfied?'] ||
        record['Non-Crisis Response - Was Caller Satisfied?'],
    ),
  );
  assignIfPresent(
    caseInformation,
    'permissionToCallBack',
    parseICarolBoolean(record['Incoming Call Information - Do you want a call back']),
  );
  assignIfPresent(
    caseInformation,
    'substanceUseLivedExperience',
    parseICarolBoolean(
      record[
        'Incoming Call Information - Have you been directly impacted by substance use?'
      ],
    ),
  );
  assignIfPresent(
    caseInformation,
    'typeOfResourceProvided',
    record['Referrals - Type of Resource'],
  );

  const rawJson: ContactRawJson = {
    callType: record['Call Information - Call Type'] || '',
    childInformation,
    caseInformation,
    categories: mapCategories(
      record[
        'The Eight Dimensions of Wellness - Eight Dimensions of Wellness - Check all that apply'
      ],
    ),
  };

  const callLengthMinutes = Number.parseInt(record.CallLength, 10);

  return {
    taskId: `WT_iCarol_${record.CallReportNum}`,
    // Imported iCarol contacts are phone calls.
    channel: 'voice',
    timeOfContact: record.CallDateAndTimeStart || undefined,
    // iCarol records the call length in minutes, Aselo stores it in seconds.
    conversationDuration: Number.isNaN(callLengthMinutes) ? 0 : callLengthMinutes * 60,
    rawJson,
  };
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

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
import type { ContactRawJson, NewContactRecord } from '@tech-matters/hrm-types';

/**
 * Shape of a single row in an iCarol "CallReports" CSV export. The property
 * names match the column headers in the export. Only the columns that are
 * mapped across to an Aselo contact are listed explicitly; the index signature
 * covers the remaining (unmapped) columns.
 */
export type ICarolContactRecord = {
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
export const WELLNESS_CATEGORY_MAP: Record<
  string,
  [category: string, subcategory: string]
> = {
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
 * The Aselo callType value stored for a counselling/"data" contact. Matches the
 * `callTypes.child` constant used across HRM/flex (Contact.ts `dataCallTypes`).
 */
export const DATA_CALL_TYPE = 'Child calling about self';

/**
 * iCarol records a contact's nature using a set of boolean "Was..." columns. When
 * the "Call Information - Call Type" field is empty we infer the Aselo callType
 * from these flags. The values are the labels from the PRN CallTypeButtons form
 * definition, which is what the Flex UI stores as the callType for a non-data
 * contact (`callTypes[name] || button.label`).
 */
export const CALL_TYPE_FLAG_MAP: [field: string, callType: string][] = [
  ['WasRealCall', DATA_CALL_TYPE],
  ['WasSilentCall', 'Silent'],
  ['WasHangup', 'Hang up'],
  // The double space in 'Wrong  Number' is intentional: it matches the label in
  // the PRN CallTypeButtons form definition verbatim, so imported contacts store
  // the same callType value as contacts created through the Flex UI.
  ['WasWrongNumber', 'Wrong  Number'],
  ['WasPrankCall', 'Prank Call'],
  ['WasSexCall', 'Sexual Gratifier'],
];

/**
 * iCarol stores yes/no answers as the strings "Yes"/"No". Returns undefined for
 * empty/unrecognised values so the field can be omitted from the contact.
 */
export const parseICarolBoolean = (value: string | undefined): boolean | undefined => {
  if (!value) return undefined;
  const normalised = value.trim().toLowerCase();
  if (normalised === 'yes') return true;
  if (normalised === 'no') return false;
  return undefined;
};

/**
 * Computes the conversation duration (in seconds) from the iCarol call start and
 * end timestamps. Returns 0 when either timestamp is missing or unparseable.
 */
export const calculateConversationDuration = (
  start: string | undefined,
  end: string | undefined,
): number => {
  if (!start || !end) return 0;
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) return 0;
  return Math.round((endMs - startMs) / 1000);
};

/**
 * Parses an S3 URI (e.g. s3://my-bucket/path/to/file.csv) into its bucket & key.
 */
export const parseS3Uri = (location: string): { bucket: string; key: string } => {
  const { protocol, hostname, pathname } = new URL(location);
  if (protocol !== 's3:') {
    throw new Error(`location must be an S3 URI (s3://bucket/key), got: ${location}`);
  }
  // pathname always starts with a leading slash, which is not part of the S3 key.
  const key = pathname.startsWith('/') ? pathname.slice(1) : pathname;
  return { bucket: hostname, key: decodeURIComponent(key) };
};

/**
 * Builds the Aselo "Categories" structure from the iCarol "Eight Dimensions of
 * Wellness" field, which is a semicolon separated list of dimensions.
 */
export const mapCategories = (
  dimensions: string | undefined,
): ContactRawJson['categories'] => {
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
export const assignIfPresent = (
  target: Record<string, string | boolean>,
  key: string,
  value: string | boolean | undefined,
) => {
  if (value === undefined || value === '') return;
  target[key] = value;
};

/**
 * Determines the Aselo `callType` and, for counselling contacts, whether the call
 * was a crisis, from the iCarol record.
 *
 * - When "Call Information - Call Type" is "Crisis"/"Non-Crisis" the contact is a
 *   counselling contact, so the callType becomes the data callType ("Child calling
 *   about self") and an `isCrisis` boolean is recorded under caseInformation.
 * - When that field is empty, the callType is inferred from the iCarol "Was..."
 *   boolean flags (e.g. WasHangup, WasSilentCall).
 * - Any other non-empty value is passed through unchanged.
 */
export const mapCallType = (
  record: ICarolContactRecord,
): { callType: string; isCrisis?: boolean } => {
  const rawCallType = (record['Call Information - Call Type'] ?? '').trim();
  const normalised = rawCallType.toLowerCase();

  if (normalised === 'crisis') return { callType: DATA_CALL_TYPE, isCrisis: true };
  if (normalised === 'non-crisis' || normalised === 'non crisis') {
    return { callType: DATA_CALL_TYPE, isCrisis: false };
  }
  if (rawCallType) return { callType: rawCallType };

  // Fall back to inferring the callType from the boolean flag columns.
  const matched = CALL_TYPE_FLAG_MAP.find(
    ([field]) => parseICarolBoolean(record[field]) === true,
  );
  return { callType: matched ? matched[1] : '' };
};

/**
 * Maps a single iCarol CSV record onto the Aselo contact payload. Per the PRN
 * field mapping spreadsheet, the "Contact > Support Seeker" fields are mapped
 * onto rawJson.childInformation and the "Contact > Summary" fields onto
 * rawJson.caseInformation.
 */
export const mapContact = (record: ICarolContactRecord): Partial<NewContactRecord> => {
  // Contact > Support Seeker -> rawJson.childInformation
  const childInformation: ContactRawJson['childInformation'] = {};
  assignIfPresent(childInformation, 'friendlyName', record.CallerName);
  assignIfPresent(childInformation, 'phone1', record.PhoneNumberFull);
  assignIfPresent(childInformation, 'state', record.StateProvince);
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
    'referral988',
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
    'wasTheCallerSatisfiedWithTheSupportProvided',
    parseICarolBoolean(
      record['Follow up Outcome - Was the caller satisfied?'] ||
        record['Non-Crisis Response - Was Caller Satisfied?'],
    ),
  );
  assignIfPresent(
    caseInformation,
    'doWeHaveTheirPermissionToCallBack',
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
  assignIfPresent(caseInformation, 'referrals', record['Referrals - Type of Resource']);

  const { callType, isCrisis } = mapCallType(record);
  assignIfPresent(caseInformation, 'isCrisis', isCrisis);

  const rawJson: ContactRawJson = {
    callType,
    childInformation,
    caseInformation,
    categories: mapCategories(
      record[
        'The Eight Dimensions of Wellness - Eight Dimensions of Wellness - Check all that apply'
      ],
    ),
  };

  return {
    taskId: `WT_iCarol_${record.CallReportNum}`,
    // Imported iCarol contacts are phone calls.
    channel: 'voice',
    timeOfContact: record.CallDateAndTimeStart || undefined,
    // Aselo stores the conversation duration in seconds, derived from the iCarol
    // call start and end timestamps.
    conversationDuration: calculateConversationDuration(
      record.CallDateAndTimeStart,
      record.CallDateAndTimeEnd,
    ),
    rawJson,
  };
};

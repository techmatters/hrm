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
import type { TwilioUserIdentifier, WorkerSID } from '@tech-matters/types';

/**
 * Maps a Twilio worker's full name (as it appears in iCarol's "PhoneWorkerName"
 * column) to that worker's Twilio SID, so imported contacts can be attributed to
 * the counsellor that handled the call.
 */
export type WorkerSidsByName = Map<string, WorkerSID>;

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
 * iCarol dimension name.
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
 * from these flags. The values are the labels from the usnc CallTypeButtons form
 * definition, which is what the Flex UI stores as the callType for a non-data
 * contact (`callTypes[name] || button.label`).
 */
export const CALL_TYPE_FLAG_MAP: [field: string, callType: string][] = [
  ['WasRealCall', DATA_CALL_TYPE],
  ['WasSilentCall', 'Silent'],
  ['WasHangup', 'Hang up'],
  // The double space in 'Wrong  Number' is intentional: it matches the label in
  // the usnc CallTypeButtons form definition verbatim, so imported contacts store
  // the same callType value as contacts created through the Flex UI.
  ['WasWrongNumber', 'Wrong  Number'],
  ['WasPrankCall', 'Prank Call'],
  ['WasSexCall', 'Sexual Gratifier'],
];

/**
 * iCarol -> Aselo value translations, keyed by childInformation field name and
 * normalized (trimmed, lowercased) iCarol value. Values not listed here
 * already match an Aselo option verbatim.
 */
export const FIELD_VALUE_TRANSLATIONS: Record<string, Record<string, string>> = {
  ethnicity: {
    'non hispanic/non latino': 'Not Hispanic or Latino',
  },
  gender: {
    'did not ask/did not disclose': 'Refused to Disclose',
  },
  pronouns: {
    'he/him/his': 'He/Him/His',
    'she/her/hers': 'She/Her/Hers',
    'they/them': 'They/Them/Theirs',
    other: 'Other',
  },
  race: {
    caucasian: 'White',
    'african american': 'Black/African American',
    other: 'Other',
  },
  militaryStatus: {
    active: 'Active Duty',
  },
  howDidYouHearAboutTheWarmLine: {
    // Source value has a trailing space and lowercase "line"; trim/lowercase handles both.
    'another warm/crisis line': 'Another Warm/Crisis Line',
  },
};

/**
 * Translates a raw iCarol value into its Aselo equivalent. Blank/missing
 * returns undefined so the field is omitted; an unrecognized value passes
 * through unchanged (trimmed).
 */
export const translateFieldValue = (
  field: string,
  rawValue: string | undefined,
): string | undefined => {
  const trimmed = (rawValue ?? '').trim();
  if (!trimmed) return undefined;
  return FIELD_VALUE_TRANSLATIONS[field]?.[trimmed.toLowerCase()] ?? trimmed;
};

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
 * Splits a semicolon-separated iCarol multiselect value into its individual,
 * trimmed values, dropping empty segments.
 */
export const splitMultiselectValue = (rawValue: string | undefined): string[] =>
  (rawValue ?? '')
    .split(';')
    .map(part => part.trim())
    .filter(Boolean);

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
 * Determines the Aselo `callType` from the iCarol record.
 *
 * - When "Call Information - Call Type" is "Crisis"/"Non-Crisis" the contact is a
 *   counselling contact, so the callType becomes the data callType ("Child calling
 *   about self"). Crisis/Non-Crisis itself is not recorded anywhere else on the
 *   contact.
 * - When that field is empty, the callType is inferred from the iCarol "Was..."
 *   boolean flags (e.g. WasHangup, WasSilentCall).
 * - Any other non-empty value is passed through unchanged.
 */
export const mapCallType = (record: ICarolContactRecord): { callType: string } => {
  const rawCallType = (record['Call Information - Call Type'] ?? '').trim();
  const normalised = rawCallType.toLowerCase();

  if (
    normalised === 'crisis' ||
    normalised === 'non-crisis' ||
    normalised === 'non crisis'
  ) {
    return { callType: DATA_CALL_TYPE };
  }
  if (rawCallType) return { callType: rawCallType };

  // Fall back to inferring the callType from the boolean flag columns.
  const matched = CALL_TYPE_FLAG_MAP.find(
    ([field]) => parseICarolBoolean(record[field]) === true,
  );
  return { callType: matched ? matched[1] : '' };
};

/**
 * Normalises a worker name for conservative, non-exact comparison: trims,
 * lowercases, drops periods/commas, and collapses repeated whitespace. Does
 * not attempt typo-tolerant matching -- a name that's merely formatted
 * differently should match; a genuinely different name should not.
 */
export const normalizeWorkerName = (name: string): string =>
  name.trim().toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ');

/**
 * Resolves the Twilio worker SID for an iCarol record from its "PhoneWorkerName"
 * (the counsellor's full name) using the supplied name -> SID lookup. Tries an
 * exact match first, then a conservative normalised match. If more than one
 * real worker normalises to the same name, that's treated as no match rather
 * than guessed at. Returns undefined when the worker name is blank, there's no
 * lookup available, or nothing matches.
 */
export const resolveWorkerSid = (
  record: ICarolContactRecord,
  workerSidsByName?: WorkerSidsByName,
): WorkerSID | undefined => {
  const name = (record.PhoneWorkerName ?? '').trim();
  if (!name || !workerSidsByName) return undefined;

  const exactMatch = workerSidsByName.get(name);
  if (exactMatch) return exactMatch;

  const normalizedTarget = normalizeWorkerName(name);
  const normalizedMatches = new Set<WorkerSID>();
  for (const [candidateName, sid] of workerSidsByName) {
    if (normalizeWorkerName(candidateName) === normalizedTarget) {
      normalizedMatches.add(sid);
    }
  }
  return normalizedMatches.size === 1 ? [...normalizedMatches][0] : undefined;
};

/**
 * Builds a deterministic, obviously-synthetic worker identifier for a
 * departed/unmatched counsellor name, so distinct historical names stay
 * distinguishable rather than collapsing into one shared placeholder. The
 * same name always produces the same identifier.
 */
export const buildLegacyWorkerSid = (name: string): WorkerSID =>
  `LEGACY_${name.trim().replace(/[^a-zA-Z0-9]+/g, '_')}` as WorkerSID;

/**
 * Tracks which original name each synthetic worker ID was first built for,
 * so a sanitisation collision between two different real names can be
 * detected instead of silently merging them.
 */
export type SyntheticWorkerRegistry = Map<string, string>;

export type SyntheticWorkerLookupResult =
  | { status: 'new' }
  | { status: 'seen' }
  | { status: 'collision'; previousName: string };

/**
 * Records a synthetic worker ID's use for a given original name, reporting
 * whether this is the first time it's been seen, a repeat of the same name,
 * or a collision with a different name that sanitised to the same ID.
 */
export const registerSyntheticWorker = (
  registry: SyntheticWorkerRegistry,
  sanitizedId: string,
  originalName: string,
): SyntheticWorkerLookupResult => {
  const previousName = registry.get(sanitizedId);
  if (previousName === undefined) {
    registry.set(sanitizedId, originalName);
    return { status: 'new' };
  }
  return previousName === originalName
    ? { status: 'seen' }
    : { status: 'collision', previousName };
};

/**
 * Maps a single iCarol CSV record onto the Aselo contact payload. The
 * "Contact > Support Seeker" fields are mapped onto rawJson.childInformation
 * and the "Contact > Summary" fields onto rawJson.caseInformation.
 *
 * The contact is attributed to the provided worker SID: the worker SID populates
 * `twilioWorkerId`, `createdBy` and the `contactlessTask.createdOnBehalfOf`
 * field in rawJson.
 */
export const mapContact = (
  record: ICarolContactRecord,
  workerSid: WorkerSID,
): Partial<NewContactRecord> => {
  // Contact > Support Seeker -> rawJson.childInformation
  const childInformation: ContactRawJson['childInformation'] = {};
  assignIfPresent(childInformation, 'friendlyName', record.CallerName);
  assignIfPresent(
    childInformation,
    'phone1',
    translateFieldValue('phone1', record.PhoneNumberFull),
  );
  assignIfPresent(
    childInformation,
    'state',
    translateFieldValue('state', record.StateProvince),
  );
  assignIfPresent(
    childInformation,
    'county',
    translateFieldValue('county', record.CountyName),
  );
  // Demographic and Warmline-source fields are translated -- see
  // translateFieldValue.
  assignIfPresent(
    childInformation,
    'ageRange',
    translateFieldValue('ageRange', record['Caller Demographics - Age Range']),
  );
  assignIfPresent(
    childInformation,
    'ethnicity',
    translateFieldValue('ethnicity', record['Caller Demographics - Ethnicity']),
  );
  assignIfPresent(
    childInformation,
    'gender',
    translateFieldValue('gender', record['Caller Demographics - Gender']),
  );
  assignIfPresent(
    childInformation,
    'militaryStatus',
    translateFieldValue(
      'militaryStatus',
      record['Caller Demographics - Military Status'],
    ),
  );
  assignIfPresent(
    childInformation,
    'pronouns',
    translateFieldValue('pronouns', record['Caller Demographics - Pronouns']),
  );
  assignIfPresent(
    childInformation,
    'race',
    translateFieldValue('race', record['Caller Demographics - Race']),
  );
  assignIfPresent(
    childInformation,
    'referral988',
    record['Caller Demographics - 988 referral'],
  );
  assignIfPresent(
    childInformation,
    'howDidYouHearAboutTheWarmLine',
    translateFieldValue(
      'howDidYouHearAboutTheWarmLine',
      record['Incoming Call Information - How did you hear about the Warmline?'],
    ),
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
  // "referrals" is a multiselect field: Aselo expects an array of the
  // selected options, not the raw semicolon-joined string.
  const referrals = splitMultiselectValue(record['Referrals - Type of Resource']);
  if (referrals.length > 0) {
    (caseInformation as Record<string, unknown>).referrals = referrals;
  }

  const { callType } = mapCallType(record);

  const rawJson: ContactRawJson = {
    callType,
    childInformation,
    caseInformation,
    categories: mapCategories(
      record[
        'The Eight Dimensions of Wellness - Eight Dimensions of Wellness - Check all that apply'
      ],
    ),
    contactlessTask: { channel: 'voice', createdOnBehalfOf: workerSid },
  };

  return {
    taskId: `TK_legacy_${record.CallReportNum}`,
    definitionVersion: 'usnc-v1',
    // Imported iCarol contacts are phone calls.
    channel: 'default',
    timeOfContact: record.CallDateAndTimeStart || undefined,
    // Aselo stores the conversation duration in seconds, derived from the iCarol
    // call start and end timestamps.
    conversationDuration: calculateConversationDuration(
      record.CallDateAndTimeStart,
      record.CallDateAndTimeEnd,
    ),
    twilioWorkerId: workerSid,
    createdBy: workerSid as TwilioUserIdentifier,
    rawJson,
  };
};

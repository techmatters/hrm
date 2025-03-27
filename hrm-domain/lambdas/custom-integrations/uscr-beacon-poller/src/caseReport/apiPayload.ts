/**
 * Copyright (C) 2021-2023 Technology Matters
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

export type CaseReportContentNode = {
  type:
    | 'text'
    | 'section'
    | 'text_field'
    | 'date_time_field'
    | 'option'
    | 'dropdown'
    | 'date_time_field_calc'
    | 'checkbox'
    | 'documents';
  value: string | null;
  fields: CaseReportContentNode[] | null;
  label: string;
} & Record<string, string | null | number | CaseReportContentNode[]>;

type CaseReportContentValues = {
  [key: string]: string | null | number | boolean | CaseReportContentValues;
};

type RelevantRawCaseReportApiPayload = {
  id: number;
  case_id: string | null;
  incident_id: number;
  created_at: string;
  updated_at: string;
  content: {
    fields: CaseReportContentNode[];
  };
};

export type RawCaseReportApiPayload = RelevantRawCaseReportApiPayload &
  Omit<Record<string, any>, keyof RelevantRawCaseReportApiPayload>;

type RelevantProcessedCaseReportApiPayload = Omit<
  RelevantRawCaseReportApiPayload,
  'content'
> & {
  'Primary Disposition': {
    'Select One': string | null;
  };
  'Secondary Disposition': {
    'Tangible Resources Provided': Record<string, boolean> | null;
    'Information Provided': Record<string, boolean> | null;
    'Referral Provided': Record<string, boolean> | null;
    'Services Obtained': Record<string, boolean> | null;
  };
  'Narrative / Summary ': {
    Behavior?: string | null;
    Intervention?: string | null;
    Response?: string | null;
    Plan?: string | null;
  };
  Demographics?: {
    'First Name'?: string | null;
    'Last Name'?: string | null;
    Nickname?: string | null;
    'Date of Birth'?: string | null;
    Gender?: {
      'Select Gender': string | null;
      'For other, document here ...': string | null;
    };
    'Race/Ethnicity'?: string | null;
    Language?: string | null;
    'Language Other'?: string | null;
  };
  'Safety Plan'?: {
    'Write Signs Here'?: string | null;
    'Write Strategies Here'?: string | null;
    'Write People or Places Here'?: string | null;
    'Write Here'?: string | null;
    'Write Contact(s) Here'?: string | null;
    'Write How Here'?: string | null;
  };
  'Collaborative SUD Survey'?: {
    'In the past 3 months, have you used any of the following substances (check all that apply)'?: Record<
      string,
      boolean | string | null
    > | null;
    'In the past 3 months, have you ever tried and failed to control, cut down, or stop using the substances listed above?'?: string;
    'Are you interested in treatment for substance use disorder? If yes, continue with survey.'?: string;
    'There are several options for substance use disorder treatment. Which are you interested in?'?: Record<
      string,
      boolean
    > | null;
    'Do you have a pet(s)/service animal(s)?'?: string | null;
    'What type of pet(s)/service animal(s)?'?: string | null;
    'Is separating from your pet(s)/service animal a barrier to participating in the pilot program?'?: string;
  };
  'Issue Report': // | ({ Narrative: string | null } & Omit<Record<string, boolean>, 'Narrative') Doesn't work :-(
  Record<string, boolean | string | null> | null;
};

export type ProcessedCaseReportApiPayload = RelevantProcessedCaseReportApiPayload &
  Omit<Record<string, any>, keyof RelevantProcessedCaseReportApiPayload>;

const extractContentNodeValues = ({
  type,
  value,
  fields,
  label,
}: CaseReportContentNode): CaseReportContentValues[keyof CaseReportContentValues] => {
  switch (type) {
    case 'section': {
      const sectionEntries = (fields || []).map(node => [
        node.label,
        extractContentNodeValues(node),
      ]);
      return Object.fromEntries(sectionEntries);
    }
    case 'checkbox': {
      return value === label;
    }
    default: {
      return value;
    }
  }
};

export const restructureApiContent = ({
  content,
  ...topLevelProperties
}: RawCaseReportApiPayload): ProcessedCaseReportApiPayload => {
  const fieldsExtractedFromContent = extractContentNodeValues({
    fields: content.fields,
    type: 'section',
    label: '',
    value: null,
  }) as CaseReportContentValues;
  return {
    ...fieldsExtractedFromContent,
    ...topLevelProperties,
  } as ProcessedCaseReportApiPayload;
};

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

const openRules = require('../permission-rules/open.json');
const closedRules = require('../permission-rules/closed.json');
const demoRules = require('../permission-rules/demo.json');
const devRules = require('../permission-rules/dev.json');
const e2eRules = require('../permission-rules/e2e.json');
const brRules = require('../permission-rules/br.json');
const caRules = require('../permission-rules/ca.json');
const clhsRules = require('../permission-rules/clhs.json');
const clRules = require('../permission-rules/cl.json');
const coRules = require('../permission-rules/co.json');
const etRules = require('../permission-rules/et.json');
const eumcRules = require('../permission-rules/eumc.json');
const huRules = require('../permission-rules/hu.json');
const inRules = require('../permission-rules/in.json');
const jmRules = require('../permission-rules/jm.json');
const mtRules = require('../permission-rules/mt.json');
const mwRules = require('../permission-rules/mw.json');
const nzRules = require('../permission-rules/nz.json');
const nzbaRules = require('../permission-rules/nzba.json');
const phRules = require('../permission-rules/ph.json');
const sgRules = require('../permission-rules/sg.json');
const ukmhRules = require('../permission-rules/ukmh.json');
const uschRules = require('../permission-rules/usch.json');
const uscrRules = require('../permission-rules/uscr.json');
const usvcRules = require('../permission-rules/usvc.json');
const thRules = require('../permission-rules/th.json');
const tzRules = require('../permission-rules/tz.json');
const zaRules = require('../permission-rules/za.json');
const zmRules = require('../permission-rules/zm.json');
const zwRules = require('../permission-rules/zw.json');

import { assertExhaustive } from '@tech-matters/types';
import type { ContactRawJson } from '@tech-matters/hrm-types';
import { actionsMaps, Actions, TargetKind, isTargetKind } from './actions';
import type { ProfileSection } from '../profile/profileDataAccess';

const timeBasedConditions = ['createdHoursAgo', 'createdDaysAgo'] as const;
export type TimeBasedCondition = { [K in (typeof timeBasedConditions)[number]]?: number };

export const isTimeBasedCondition = (c: any): c is TimeBasedCondition => {
  if (typeof c === 'object') {
    const [[cond, param]] = Object.entries(c);
    return timeBasedConditions.includes(cond as any) && typeof param === 'number';
  }

  return false;
};

const userBasedConditions = ['isSupervisor', 'everyone'] as const;
export type UserBasedCondition = (typeof userBasedConditions)[number];

const isUserBasedCondition = (c: any): c is UserBasedCondition =>
  typeof c === 'string' && userBasedConditions.includes(c as any);

const contactSpecificConditions = ['isOwner'] as const;
export type ContactSpecificCondition = (typeof contactSpecificConditions)[number];

const isContactSpecificCondition = (c: any): c is ContactSpecificCondition =>
  typeof c === 'string' && contactSpecificConditions.includes(c as any);

export type ContactFieldSpecificCondition = {
  field: `rawJson.${keyof ContactRawJson}.${string}`;
};

/**
 * Validates that a field string matches the format rawJson.<validKey>.<fieldPath>
 * where validKey is one of the keys in ContactRawJson type
 */
const isValidContactFieldPath = (field: string): boolean => {
  const RAW_JSON_PREFIX = 'rawJson.';
  if (!field.startsWith(RAW_JSON_PREFIX)) {
    return false;
  }

  const pathWithoutPrefix = field.slice(RAW_JSON_PREFIX.length);
  const parts = pathWithoutPrefix.split('.');

  // Must have at least 2 parts: <ContactRawJsonKey>.<fieldPath>
  if (parts.length < 2) {
    return false;
  }

  // Valid keys from ContactRawJson type
  const validContactRawJsonKeys = [
    'definitionVersion',
    'callType',
    'childInformation',
    'callerInformation',
    'categories',
    'caseInformation',
    'contactlessTask',
    'llmSupportedEntries',
    'hangUpBy',
    'referrals',
  ];

  const contactRawJsonKey = parts[0];
  return validContactRawJsonKeys.includes(contactRawJsonKey);
};

export const isContactFieldSpecificCondition = (
  c: any,
): c is ContactFieldSpecificCondition => {
  if (typeof c === 'object') {
    const [[cond, param]] = Object.entries(c);
    return (
      cond === 'field' && typeof param === 'string' && isValidContactFieldPath(param)
    );
  }

  return false;
};

const caseSpecificConditions = ['isCreator', 'isCaseOpen', 'isCaseContactOwner'] as const;
export type CaseSpecificCondition = (typeof caseSpecificConditions)[number];

const isCaseSpecificCondition = (c: any): c is CaseSpecificCondition =>
  typeof c === 'string' && caseSpecificConditions.includes(c as any);

// const profileSectionSpecificConditions = ['sectionType'] as const;
export type ProfileSectionSpecificCondition = {
  sectionType: ProfileSection['sectionType'];
};

export const isProfileSectionSpecificCondition = (
  c: any,
): c is ProfileSectionSpecificCondition => {
  if (typeof c === 'object') {
    const [[cond, param]] = Object.entries(c);
    return cond === 'sectionType' && typeof param === 'string';
  }

  return false;
};

type SupportedContactCondition =
  | TimeBasedCondition
  | UserBasedCondition
  | ContactSpecificCondition;
const isSupportedContactCondition = (c: any): c is SupportedContactCondition =>
  isTimeBasedCondition(c) || isUserBasedCondition(c) || isContactSpecificCondition(c);

type SupportedContactFieldCondition =
  | TimeBasedCondition
  | UserBasedCondition
  | ContactSpecificCondition
  | ContactFieldSpecificCondition;

const isSupportedContactFieldCondition = (c: any): c is SupportedContactFieldCondition =>
  isTimeBasedCondition(c) ||
  isUserBasedCondition(c) ||
  isContactSpecificCondition(c) ||
  isContactFieldSpecificCondition(c);

type SupportedCaseCondition =
  | TimeBasedCondition
  | UserBasedCondition
  | CaseSpecificCondition;
const isSupportedCaseCondition = (c: any): c is SupportedCaseCondition =>
  isTimeBasedCondition(c) || isUserBasedCondition(c) || isCaseSpecificCondition(c);

type SupportedProfileCondition = TimeBasedCondition | UserBasedCondition;
const isSupportedProfileCondition = (c: any): c is SupportedProfileCondition =>
  isTimeBasedCondition(c) || isUserBasedCondition(c);

type SupportedProfileSectionCondition =
  | TimeBasedCondition
  | UserBasedCondition
  | ProfileSectionSpecificCondition;
const isSupportedProfileSectionCondition = (
  c: any,
): c is SupportedProfileSectionCondition =>
  isTimeBasedCondition(c) ||
  isUserBasedCondition(c) ||
  isProfileSectionSpecificCondition(c);

type SupportedPostSurveyCondition = TimeBasedCondition | UserBasedCondition;
const isSupportedPostSurveyCondition = (c: any): c is SupportedPostSurveyCondition =>
  isTimeBasedCondition(c) || isUserBasedCondition(c);

// Defines which actions are supported on each TargetKind
type SupportedTKCondition = {
  contact: SupportedContactCondition;
  contactField: SupportedContactFieldCondition;
  case: SupportedCaseCondition;
  profile: SupportedProfileCondition;
  profileSection: SupportedProfileSectionCondition;
  postSurvey: SupportedPostSurveyCondition;
};

export type TKCondition<T extends TargetKind> = SupportedTKCondition[T];
export type TKConditionsSet<T extends TargetKind> = TKCondition<T>[];
export type TKConditionsSets<T extends TargetKind> = TKConditionsSet<T>[];

export type TKAction<T extends TargetKind> = keyof (typeof actionsMaps)[T];
type ParameterizedCondition =
  | TimeBasedCondition
  | ProfileSectionSpecificCondition
  | ContactFieldSpecificCondition;
type ExtractSupportedConditionKeys<T extends string | ParameterizedCondition> =
  T extends string ? T : keyof T;

type UnsupportedActionConditions = {
  [TK in TargetKind]?: {
    [K in TKAction<TK>]?: ExtractSupportedConditionKeys<SupportedTKCondition[TK]>[];
  };
};

const unsupportedActionConditions: UnsupportedActionConditions = {
  profileSection: {
    CREATE_PROFILE_SECTION: ['sectionType'],
  },
  contactField: {
    EDIT_CONTACT_FIELD: ['field'],
    VIEW_CONTACT_FIELD: ['field'],
  },
};

const isConditionSupported = <T extends TargetKind>(
  kind: T,
  actionName: string,
  condition: SupportedTKCondition[T],
) => {
  const unsupportedConditions = unsupportedActionConditions[kind]?.[actionName];
  if (!unsupportedConditions) {
    return true;
  }

  if (typeof condition === 'object') {
    return !Object.keys(condition).some(key => unsupportedConditions.includes(key));
  }

  return !unsupportedConditions.includes(condition);
};

const isTKCondition =
  <T extends TargetKind>(kind: T) =>
  (c: any): c is TKCondition<T> => {
    if (!c) {
      return false;
    }

    switch (kind) {
      case 'contact': {
        return isSupportedContactCondition(c);
      }
      case 'contactField': {
        return isSupportedContactFieldCondition(c);
      }
      case 'case': {
        return isSupportedCaseCondition(c);
      }
      case 'profile': {
        return isSupportedProfileCondition(c);
      }
      case 'profileSection': {
        return isSupportedProfileSectionCondition(c);
      }
      case 'postSurvey': {
        return isSupportedPostSurveyCondition(c);
      }
      default: {
        assertExhaustive(kind);
      }
    }
  };

const isTKConditionsSet =
  <T extends TargetKind>(kind: TargetKind) =>
  (cs: any): cs is TKConditionsSet<T> => {
    if (!cs || !Array.isArray(cs) || !cs.every(isTKCondition(kind))) {
      return false;
    }

    // For contactField target kind, ensure condition set doesn't have multiple field conditions
    if (kind === 'contactField') {
      const fieldConditions = cs.filter(isContactFieldSpecificCondition);
      if (fieldConditions.length > 1) {
        return false;
      }
    }

    return true;
  };

const isTKConditionsSets =
  <T extends TargetKind>(kind: TargetKind) =>
  (css: any): css is TKConditionsSets<T> =>
    css && Array.isArray(css) && css.every(isTKConditionsSet(kind));

// Export for testing
export const validateContactFieldConditionsSet = (cs: any): boolean =>
  isTKConditionsSet('contactField')(cs);
export const validateContactFieldConditionsSets = (css: any): boolean =>
  isTKConditionsSets('contactField')(css);

export type RulesFile = { [k in Actions]: TKConditionsSets<TargetKind> };

const isValidTKConditionsSets =
  <T extends TargetKind>(kind: T) =>
  (css: TKConditionsSets<TargetKind>): css is TKConditionsSets<typeof kind> =>
    css ? css.every(cs => cs.every(isTKCondition(kind))) : false;

export const isRulesFile = (rules: any): rules is RulesFile =>
  Object.values(actionsMaps).every(map =>
    Object.values(map).every(action => isTKConditionsSets(rules[action])),
  );

/**
 * Validates that for every TK, the ConditionsSets provided are valid
 * (i.e. present in supportedTKConditions)
 */
const validateTKActions = (rules: RulesFile) =>
  Object.entries(actionsMaps)
    .map(([kind, map]) =>
      Object.entries(map).reduce((accum, [actionName, action]) => {
        return {
          ...accum,
          [action]:
            isTargetKind(kind) &&
            isValidTKConditionsSets(kind)(rules[action]) &&
            rules[action]
              .flat()
              .every(condition => isConditionSupported(kind, actionName, condition)),
        };
      }, {}),
    )
    .reduce<{ [k in Actions]: boolean }>(
      (accum, obj) => ({ ...accum, ...obj }),
      {} as any,
    );

const isValidTargetKindActions = (validated: { [k in Actions]: boolean }) =>
  Object.values(validated).every(Boolean);

const rulesMapDef = {
  br: brRules,
  ca: caRules,
  clhs: clhsRules,
  cl: clRules,
  co: coRules,
  et: etRules,
  hu: huRules,
  in: inRules,
  jm: jmRules,
  mt: mtRules,
  mw: mwRules,
  nz: nzRules,
  nzba: nzbaRules,
  ph: phRules,
  sg: sgRules,
  th: thRules,
  tz: tzRules,
  ukmh: ukmhRules,
  usch: uschRules,
  uscr: uscrRules,
  usvc: usvcRules,
  za: zaRules,
  zm: zmRules,
  zw: zwRules,
  open: openRules,
  closed: closedRules,
  demo: demoRules,
  dev: devRules,
  e2e: e2eRules,
  eumc: eumcRules,
} as const;

/**
 * For every entry of rulesMapDef, validates that every are valid RulesFile definitions,
 * and that the actions on each TK are provided with valid TKConditionsSets
 */
export const validRulesMap = () =>
  // This type assertion is legit as long as we check that every entry in rulesMapDef is indeed a RulesFile
  Object.entries(rulesMapDef).reduce<{ [k in keyof typeof rulesMapDef]: RulesFile }>(
    (accum, [k, rules]) => {
      if (!isRulesFile(rules)) {
        throw new Error(`Error: rules file for ${k} is not a valid RulesFile`);
      }

      const validated = validateTKActions(rules);
      if (!isValidTargetKindActions(validated)) {
        const invalidActions = Object.entries(validated)
          .filter(([, val]) => !val)
          .map(([key]) => key);

        throw new Error(
          `Error: rules file for ${k} contains invalid actions mappings: ${JSON.stringify(
            invalidActions,
          )}`,
        );
      }

      return { ...accum, [k]: rules };
    },
    null,
  );

export const rulesMap = validRulesMap();

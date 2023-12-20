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

const openRules = require('../../permission-rules/open.json');
const closedRules = require('../../permission-rules/closed.json');
const demoRules = require('../../permission-rules/demo.json');
const devRules = require('../../permission-rules/dev.json');
const e2eRules = require('../../permission-rules/e2e.json');
const brRules = require('../../permission-rules/br.json');
const caRules = require('../../permission-rules/ca.json');
const clRules = require('../../permission-rules/cl.json');
const coRules = require('../../permission-rules/co.json');
const etRules = require('../../permission-rules/et.json');
const huRules = require('../../permission-rules/hu.json');
const inRules = require('../../permission-rules/in.json');
const jmRules = require('../../permission-rules/jm.json');
const mtRules = require('../../permission-rules/mt.json');
const mwRules = require('../../permission-rules/mw.json');
const nzRules = require('../../permission-rules/nz.json');
const phRules = require('../../permission-rules/ph.json');
const plRules = require('../../permission-rules/pl.json');
const roRules = require('../../permission-rules/ro.json');
const sgRules = require('../../permission-rules/sg.json');
const thRules = require('../../permission-rules/th.json');
const ukRules = require('../../permission-rules/uk.json');
const zaRules = require('../../permission-rules/za.json');
const zmRules = require('../../permission-rules/zm.json');
const zwRules = require('../../permission-rules/zw.json');

import { actionsMaps, Actions, TargetKind, isTargetKind } from './actions';

const timeBasedConditions = ['createdHoursAgo', 'createdDaysAgo'] as const;
export type TimeBasedCondition = { [K in (typeof timeBasedConditions)[number]]: number };

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

const caseSpecificConditions = ['isCreator', 'isCaseOpen'] as const;
export type CaseSpecificCondition = (typeof caseSpecificConditions)[number];

const isCaseSpecificCondition = (c: any): c is CaseSpecificCondition =>
  typeof c === 'string' && caseSpecificConditions.includes(c as any);

type SupportedContactCondition =
  | TimeBasedCondition
  | UserBasedCondition
  | ContactSpecificCondition;
const isSupportedContactCondition = (c: any): c is SupportedContactCondition =>
  isTimeBasedCondition(c) || isUserBasedCondition(c) || isContactSpecificCondition(c);

type SupportedCaseCondition =
  | TimeBasedCondition
  | UserBasedCondition
  | CaseSpecificCondition;
const isSupportedCaseCondition = (c: any): c is SupportedCaseCondition =>
  isTimeBasedCondition(c) || isUserBasedCondition(c) || isCaseSpecificCondition(c);

type SupportedPostSurveyCondition = TimeBasedCondition | UserBasedCondition;
const isSupportedPostSurveyCondition = (c: any): c is SupportedPostSurveyCondition =>
  isTimeBasedCondition(c) || isUserBasedCondition(c);

// Defines which actions are supported on each TargetKind
type SupportedTKCondition = {
  contact: SupportedContactCondition;
  case: SupportedCaseCondition;
  postSurvey: SupportedPostSurveyCondition;
};

export type TKCondition<T extends TargetKind> = SupportedTKCondition[T];
export type TKConditionsSet<T extends TargetKind> = TKCondition<T>[];
export type TKConditionsSets<T extends TargetKind> = TKConditionsSet<T>[];

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
      case 'case': {
        return isSupportedCaseCondition(c);
      }
      case 'postSurvey': {
        return isSupportedPostSurveyCondition(c);
      }
      default: {
        return false;
      }
    }
  };

const isTKConditionsSet =
  <T extends TargetKind>(kind: TargetKind) =>
  (cs: any): cs is TKConditionsSet<T> =>
    cs && Array.isArray(cs) && cs.every(isTKCondition(kind));

const isTKConditionsSets =
  <T extends TargetKind>(kind: TargetKind) =>
  (css: any): css is TKConditionsSets<T> =>
    css && Array.isArray(css) && css.every(isTKConditionsSet(kind));

export type RulesFile = { [k in Actions]: TKConditionsSets<TargetKind> };

const isValidTKConditionsSets =
  <T extends TargetKind>(kind: T) =>
  (css: TKConditionsSets<TargetKind>): css is TKConditionsSets<typeof kind> =>
    css.every(cs => cs.every(isTKCondition(kind)));

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
      Object.values(map).reduce((accum, action) => {
        return {
          ...accum,
          [action]: isTargetKind(kind) && isValidTKConditionsSets(kind)(rules[action]),
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
  cl: clRules,
  co: coRules,
  et: etRules,
  hu: huRules,
  in: inRules,
  jm: jmRules,
  mt: mtRules,
  mw: mwRules,
  nz: nzRules,
  ph: phRules,
  pl: plRules,
  ro: roRules,
  sg: sgRules,
  th: thRules,
  uk: ukRules,
  za: zaRules,
  zm: zmRules,
  zw: zwRules,
  open: openRules,
  closed: closedRules,
  demo: demoRules,
  dev: devRules,
  e2e: e2eRules,
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

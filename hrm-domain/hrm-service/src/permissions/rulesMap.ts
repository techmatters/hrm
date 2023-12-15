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

import { actionsMaps, Actions, TargetKind } from './actions';
import { parseConditionsSets } from './parser/parser';

const userBasedConditions = {
  IsSupervisor: 'isSupervisor',
  Everyone: 'everyone',
} as const;
const timeBasedConditions = {
  CreatedHoursAgo: 'createdHoursAgo',
  CreatedDaysAgo: 'createdDaysAgo',
} as const;
const contactSpecificConditions = {
  IsOwner: 'isOwner',
} as const;
const caseSpecificConditions = {
  IsCreator: 'isCreator',
  IsCaseOpen: 'isCaseOpen',
} as const;

const supportedContactConditionsMap = {
  ...timeBasedConditions,
  ...userBasedConditions,
  ...contactSpecificConditions,
} as const;
const supportedContactConditions = Object.values(supportedContactConditionsMap);

const supportedCaseConditionsMap = {
  ...timeBasedConditions,
  ...userBasedConditions,
  ...caseSpecificConditions,
};
const supportedCaseConditions = Object.values(supportedCaseConditionsMap);

const supportedPostSurveyConditions = [...Object.values(userBasedConditions)] as const;

// Defines which actions are supported on each TargetKind
const supportedTKConditions = {
  contact: supportedContactConditions,
  case: supportedCaseConditions,
  postSurvey: supportedPostSurveyConditions,
} as const;

export type TKCondition<T extends TargetKind> = (typeof supportedTKConditions)[T][number];
export type TKConditionsSet<T extends TargetKind> = TKCondition<T>[];
export type TKConditionsSets<T extends TargetKind> = TKConditionsSet<T>[];

export type RulesFile = { [k in Actions]: TKConditionsSets<TargetKind> };

/**
 * Validates that for every TK, the ConditionsSets provided are valid
 * (i.e. that the all the predicates are properly parsed)
 */
const validateTKActions = (rules: RulesFile) =>
  Object.entries(actionsMaps)
    .map(([kind, map]) =>
      Object.values(map).reduce((accum, action) => {
        let result: boolean;
        try {
          parseConditionsSets(kind as TargetKind)(rules[action]);
          result = true;
        } catch (err) {
          result = false;
        }

        return {
          ...accum,
          [action]: result,
        };
      }, {}),
    )
    .reduce<{ [k in Actions]: boolean }>(
      (accum, obj) => ({ ...accum, ...obj }),
      {} as any,
    );

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
      const validated = validateTKActions(rules);

      if (!Object.values(validated).every(Boolean)) {
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

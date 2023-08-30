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
const thRules = require('../../permission-rules/th.json');
const ukRules = require('../../permission-rules/uk.json');
const zaRules = require('../../permission-rules/za.json');
const zmRules = require('../../permission-rules/zm.json');
const zwRules = require('../../permission-rules/zw.json');

import { actionsMaps, Actions, TargetKind } from './actions';

const conditionTypes = [
  'isSupervisor',
  'isCreator',
  'isCaseOpen',
  'isOwner',
  'everyone',
] as const;
export type Condition = (typeof conditionTypes)[number];
export type ConditionsSet = Condition[];
export type ConditionsSets = ConditionsSet[];

const isCondition = (c: any): c is Condition => c && conditionTypes.includes(c);
const isConditionsSet = (cs: any): cs is ConditionsSet =>
  cs && Array.isArray(cs) && cs.every(isCondition);
const isConditionsSets = (css: any): css is ConditionsSets =>
  css && Array.isArray(css) && css.every(isConditionsSet);

export type RulesFile = { [k in Actions]: ConditionsSets };

export const isRulesFile = (rules: any): rules is RulesFile =>
  Object.values(actionsMaps).every(map =>
    Object.values(map).every(action => isConditionsSets(rules[action])),
  );

// Defines which actions are supported on each TargetKind
const supportedTargetKindActions: { [k in TargetKind]: ConditionsSet } = {
  case: ['isSupervisor', 'isCreator', 'isCaseOpen', 'everyone'],
  contact: ['isSupervisor', 'isOwner', 'everyone'],
  postSurvey: ['isSupervisor', 'everyone'],
};

const isValidTargetKind = (kind: string, css: ConditionsSets) =>
  css.every(cs => cs.every(c => supportedTargetKindActions[kind].includes(c)));

const validateTargetKindActions = (rules: RulesFile) =>
  Object.entries(actionsMaps)
    .map(([kind, map]) =>
      Object.values(map).reduce((accum, action) => {
        return {
          ...accum,
          [action]: isValidTargetKind(kind, rules[action]),
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

export const validRulesMap = () =>
  // This type assertion is legit as long as we check that every entry in rulesMapDef is indeed a RulesFile
  Object.entries(rulesMapDef).reduce<{ [k in keyof typeof rulesMapDef]: RulesFile }>(
    (accum, [k, rules]) => {
      if (!isRulesFile(rules)) {
        throw new Error(`Error: rules file for ${k} is not a valid RulesFile`);
      }

      const validated = validateTargetKindActions(rules);
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

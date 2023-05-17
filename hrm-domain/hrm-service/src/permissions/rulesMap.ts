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

import { actionsMaps, Actions } from './actions';

export const conditionTypes = [
  'isSupervisor',
  'isCreator',
  'isCaseOpen',
  'isOwner',
  'everyone',
] as const;
export type Condition = typeof conditionTypes[number];
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
  demo: demoRules,
  dev: devRules,
  e2e: e2eRules,
} as const;

const validRulesMap = () =>
  // This type assertion is legit as long as we check that every entry in rulesMapDef is indeed a RulesFile
  Object.entries(rulesMapDef).reduce<{ [k in keyof typeof rulesMapDef]: RulesFile }>(
    (accum, [k, rules]) => {
      if (!isRulesFile(rules))
        throw new Error(`Error: rules file for ${k} is not a valid RulesFile`);

      return { ...accum, [k]: rules };
    },
    null,
  );

export const rulesMap = validRulesMap();

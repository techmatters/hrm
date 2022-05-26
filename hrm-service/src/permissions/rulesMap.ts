const openRules = require('../../permission-rules/open.json');
const demoRules = require('../../permission-rules/demo.json');
const brRules = require('../../permission-rules/br.json');
const caRules = require('../../permission-rules/ca.json');
const etRules = require('../../permission-rules/et.json');
const inRules = require('../../permission-rules/in.json');
const jmRules = require('../../permission-rules/jm.json');
const mwRules = require('../../permission-rules/mw.json');
const ukRules = require('../../permission-rules/uk.json');
const zaRules = require('../../permission-rules/za.json');
const zmRules = require('../../permission-rules/zm.json');

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
  et: etRules,
  in: inRules,
  jm: jmRules,
  mw: mwRules,
  uk: ukRules,
  za: zaRules,
  zm: zmRules,
  open: openRules,
  demo: demoRules,
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

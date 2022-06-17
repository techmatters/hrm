import openRules from '../../permission-rules/open.json';
import brRules from '../../permission-rules/br.json';
import caRules from '../../permission-rules/ca.json';
import etRules from '../../permission-rules/et.json';
import inRules from '../../permission-rules/in.json';
import jmRules from '../../permission-rules/jm.json';
import mwRules from '../../permission-rules/mw.json';
import ukRules from '../../permission-rules/uk.json';
import zaRules from '../../permission-rules/za.json';
import zmRules from '../../permission-rules/zm.json';
import coRules from '../../permission-rules/co.json';

import { actionsMaps, Actions } from './actions';

export const conditionTypes = ['isSupervisor', 'isCreator', 'isCaseOpen', 'everyone'] as const;
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
  co: coRules,
  open: openRules,
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

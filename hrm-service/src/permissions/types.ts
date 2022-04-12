// TODO: move actionsMaps to this file
import { actionsMaps } from './actions';

export const conditionTypes = ['isSupervisor', 'isCreator', 'isCaseOpen', 'everyone'] as const;
export type Condition = typeof conditionTypes[number];
export type ConditionsSet = Condition[];
export type ConditionsSets = ConditionsSet[];

const isCondition = (c: any): c is Condition => c && conditionTypes.includes(c);
const isConditionsSet = (cs: any): cs is ConditionsSet =>
  cs && Array.isArray(cs) && cs.every(isCondition);
const isConditionsSets = (css: any): css is ConditionsSets =>
  css && Array.isArray(css) && css.every(isConditionsSet);

/**
 * TODO: Improve this type by moving actionsMaps to TS
 */
export type RulesFile = { [k: string]: ConditionsSets };

export const isRulesFile = (rules: any): rules is RulesFile =>
  Object.values(actionsMaps).every(map =>
    Object.values(map).every(action => isConditionsSets(rules[action])),
  );

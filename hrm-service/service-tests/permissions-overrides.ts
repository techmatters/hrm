const openRules = require('../permission-rules/open.json');
import { RulesFile } from '../src/permissions/rulesMap';

export function ruleFileWithOnePermittedOrDeniedAction(
  permittedAction: keyof RulesFile,
  isPermitted: boolean,
): RulesFile {
  const ruleEntries = Object.keys(openRules).map(key => [
    key,
    (key === permittedAction && isPermitted) || (key !== permittedAction && !isPermitted)
      ? [['everyone']]
      : [],
  ]);
  return Object.fromEntries(ruleEntries);
}

export function ruleFileWithOneActionOverride(
  targetAction: keyof RulesFile,
  isPermitted: boolean,
): RulesFile {
  return {
    ...openRules,
    [targetAction]: isPermitted ? [['everyone']] : [],
  };
}

import openRules from '../../permission-rules/open.json';
import brRules from '../../permission-rules/br.json';
import caRules from '../../permission-rules/ca.json';
import etRules from '../../permission-rules/et.json';
import inRules from '../../permission-rules/in.json';
import jmRules from '../../permission-rules/jm.json';
import mwRules from '../../permission-rules/mw.json';
import zaRules from '../../permission-rules/za.json';
import zmRules from '../../permission-rules/zm.json';

// eslint-disable-next-line prettier/prettier
import { isRulesFile, RulesFile } from './types';

const rulesMapDef = {
  br: brRules,
  ca: caRules,
  et: etRules,
  in: inRules,
  jm: jmRules,
  mw: mwRules,
  za: zaRules,
  zm: zmRules,
  open: openRules,
} as const;

const toRulesMap = () =>
  // This type assertion is legit as long as we check that every entry if rulesMapDef is indeed a RulesFile
  Object.entries(rulesMapDef).reduce<{ [k in keyof typeof rulesMapDef]: RulesFile }>(
    (accum, [k, rules]) => {
      if (!isRulesFile(rules))
        throw new Error(`Error: rules file for ${k} is not a valid RulesFile`);

      return { ...accum, [k]: rules };
    },
    null,
  );

export const rulesMap = toRulesMap();

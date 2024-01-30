import { TKCondition } from '../../permissions/rulesMap';
import { selectContactsOwnedCount } from './case-get-sql';

const ALL_OR_NOTHING_CONDITIONS: CaseListCondition[] = ['everyone', 'isSupervisor'];

export type CaseListCondition = Extract<
  TKCondition<'case'>,
  'isCreator' | 'isCaseContactOwner' | 'everyone' | 'isSupervisor' | 'isCaseOpen'
>;

type WhereClauseGeneratingCondition = Exclude<
  CaseListCondition,
  'everyone' | 'isSupervisor'
>;

const conditionWhereClauses: Record<WhereClauseGeneratingCondition, string> = {
  isCreator: `"cases"."twilioWorkerId" = $<twilioWorkerSid>`,
  isCaseContactOwner: `(${selectContactsOwnedCount('twilioWorkerSid')}) > 0`,
  isCaseOpen: `"cases"."status" != 'closed'`,
};

export const listCasesPermissionWhereClause = (
  caseListConditionSets: CaseListCondition[][],
  userIsSupervisor: boolean,
): [clause: string] | [] => {
  const conditionSetClauses: string[] = [];
  const conditionsThatAllowAll: CaseListCondition[] = userIsSupervisor
    ? ALL_OR_NOTHING_CONDITIONS
    : ['everyone'];
  for (const caseListConditionSet of caseListConditionSets) {
    // Any condition set that only has 'everyone' conditions (or isSupervisor conditions for supervisors)
    // means permissions are open regardless of what other conditions there are, so short circuit
    if (
      caseListConditionSet.every(condition => conditionsThatAllowAll.includes(condition))
    ) {
      return [];
    }

    const relevantConditions: WhereClauseGeneratingCondition[] =
      caseListConditionSet.filter(
        condition => !ALL_OR_NOTHING_CONDITIONS.includes(condition),
      ) as WhereClauseGeneratingCondition[];
    if (relevantConditions.length) {
      const conditionClauses = relevantConditions.map(
        condition => conditionWhereClauses[condition],
      );
      conditionSetClauses.push(`(${conditionClauses.join(' AND ')})`);
    }
  }
  return conditionSetClauses.length ? [conditionSetClauses.join(' OR ')] : [];
};

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

import { TKCondition } from '../../permissions/rulesMap';
import { selectContactsOwnedCount } from './case-get-sql';
import {
  ConditionWhereClauses,
  listPermissionWhereClause,
} from '../../permissions/sqlGenerators';

export type CaseListCondition = Extract<
  TKCondition<'case'>,
  'isCreator' | 'isCaseContactOwner' | 'everyone' | 'isSupervisor' | 'isCaseOpen'
>;

const conditionWhereClauses: ConditionWhereClauses<'case'> = {
  isCreator: `"cases"."twilioWorkerId" = $<twilioWorkerSid>`,
  isCaseContactOwner: `(${selectContactsOwnedCount('twilioWorkerSid')}) > 0`,
  isCaseOpen: `"cases"."status" != 'closed'`,
  timeBasedCondition: ({ createdDaysAgo, createdHoursAgo }) => {
    const timeClauses = [];
    if (typeof createdHoursAgo === 'number') {
      timeClauses.push(
        `"cases"."createdAt" > CURRENT_TIMESTAMP - interval '${createdHoursAgo} hours'`,
      );
    }
    if (typeof createdDaysAgo === 'number') {
      timeClauses.push(
        `"cases"."createdAt" > CURRENT_TIMESTAMP - interval '${createdDaysAgo} days'`,
      );
    }
    return timeClauses.length ? `(${timeClauses.join(' AND ')})` : '1=1';
  },
};

export const listCasesPermissionWhereClause = (
  caseListConditionSets: CaseListCondition[][],
  userIsSupervisor: boolean,
): [clause: string] | [] =>
  listPermissionWhereClause<'case'>(
    caseListConditionSets,
    userIsSupervisor,
    conditionWhereClauses,
  );

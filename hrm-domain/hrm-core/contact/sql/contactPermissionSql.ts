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

import {
  ContactSpecificCondition,
  TKCondition,
  UserBasedCondition,
} from '../../permissions/rulesMap';
import {
  ConditionWhereClauses,
  listPermissionWhereClause,
} from '../../permissions/sqlGenerators';

export type ContactListCondition = Extract<
  TKCondition<'contact'>,
  ContactSpecificCondition | UserBasedCondition
>;

const conditionWhereClauses: ConditionWhereClauses<'contact'> = {
  isOwner: `"contacts"."twilioWorkerId" = $<twilioWorkerSid>`,

  timeBasedCondition: ({ createdDaysAgo, createdHoursAgo }) => {
    const timeClauses = [];
    if (typeof createdHoursAgo === 'number') {
      timeClauses.push(
        `"contacts"."timeOfContact" > CURRENT_TIMESTAMP - interval '${createdHoursAgo} hours'`,
      );
    }
    if (typeof createdDaysAgo === 'number') {
      timeClauses.push(
        `"contacts"."timeOfContact" > CURRENT_TIMESTAMP - interval '${createdDaysAgo} days'`,
      );
    }
    return timeClauses.length ? `(${timeClauses.join(' AND ')})` : '1=1';
  },
};

export const listContactsPermissionWhereClause = (
  contactListConditionSets: ContactListCondition[][],
  userIsSupervisor: boolean,
): string => {
  const [clause] = listPermissionWhereClause<'contact'>(
    contactListConditionSets,
    userIsSupervisor,
    conditionWhereClauses,
  );
  return clause ?? '1=1';
};

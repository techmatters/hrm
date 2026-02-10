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
import { TwilioUser } from '@tech-matters/twilio-worker-auth/dist';
import { ActionsForTK } from '../permissions/actions';
import { Permissions } from '../permissions';
import { isContactOwner } from '../permissions/conditionChecks';
import { isTimeBasedCondition, TKConditionsSets } from '../permissions/rulesMap';
import {
  applyTimeBasedConditions,
  checkConditionsSets,
} from '../permissions/initializeCanForRules';

export const getExcludedFields =
  (permissions: Permissions) =>
  (contact: Contact, user: TwilioUser, action: ActionsForTK<'contactField'>) => {
    const rules = await permissions.rules(accountSid);
    const conditionSetsByField: Record<string, TKConditionsSets<'contactField'>> = {};
    const globalConditionSets: TKConditionsSets<'contactField'> = [];
    const actionRules = rules[action];
    for (conditionSets of actionRules) {
      for (const conditionSet of conditionSets) {
        const fieldConditions = conditionSet.filter(
          r => typeof r === 'object' && typeof r.field === 'string',
        );
        if (fieldConditions.length > 1) {
          throw new Error(
            'Multiple field conditions in a single condition set are not valid',
          );
        }
        if (fieldConditions.length === 1) {
          conditionSetsByField[fieldConditions[0].field] =
            conditionSetsByField[fieldConditions[0].field] || [];
          conditionSetsByField[fieldConditions[0].field].push(
            conditionSet.filter(r => fieldConditions[0] !== r),
          );
        } else {
          globalConditionSets.push(conditionSet);
        }
      }
    }
    const timeBasedConditions = conditionsSets.flatMap(cs =>
      cs.filter(isTimeBasedCondition),
    );

    const ctx = { currentTimestamp: new Date() };

    const appliedTimeBasedConditions = applyTimeBasedConditions(timeBasedConditions)(
      performer,
      target,
      ctx,
    );

    const conditionsState: ConditionsState = {
      isSupervisor: user.isSupervisor,
      isOwner: isContactOwner(user, target),
      everyone: true,
      ...appliedTimeBasedConditions,
    };

    if (checkConditionsSets(conditionsState, globalConditionSets)) return {};

    const excludedFields = Record<string, string[]>;
    for ([field, conditionSets] of Object.entries(conditionSetsByField)) {
      if (!checkConditionsSets(conditionsState, conditionSets)) {
        const [, formName, fieldName] = field.split('.');
        excludedFields[formName] = excludedFields[formName] || [];
        excludedFields[formName].push(fieldName);
      }
    }
    return excludedFields;
  };

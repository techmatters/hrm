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
import type { Contact, NewContactRecord } from '@tech-matters/hrm-types';
import type { TwilioUser } from '@tech-matters/twilio-worker-auth';
import type { ActionsForTK } from '../permissions/actions';
import { isContactOwner } from '../permissions/conditionChecks';
import {
  ContactFieldSpecificCondition,
  isTimeBasedCondition,
  RulesFile,
  TKConditionsSets,
} from '../permissions/rulesMap';
import {
  applyTimeBasedConditions,
  checkConditionsSets,
  ConditionsState,
} from '../permissions/initializeCanForRules';

export const getExcludedFields =
  (permissionRules: RulesFile) =>
  (
    contact: NewContactRecord | Contact,
    user: TwilioUser,
    action: ActionsForTK<'contactField'>,
  ) => {
    const generateConditionState = (
      conditionSets: TKConditionsSets<'contactField'>,
    ): ConditionsState => {
      const timeBasedConditions = conditionSets.flatMap(cs =>
        cs.filter(isTimeBasedCondition),
      );

      const ctx = { currentTimestamp: new Date() };

      const appliedTimeBasedConditions = applyTimeBasedConditions(timeBasedConditions)(
        user,
        contact,
        ctx,
      );

      return {
        isSupervisor: user.isSupervisor,
        isOwner: isContactOwner(user, contact),
        everyone: true,
        nobody: false,
        ...appliedTimeBasedConditions,
      };
    };

    // System users have full access
    if (user.isSystemUser) return {};

    const conditionSetsByField: Record<string, TKConditionsSets<'contactField'>> = {};
    const globalConditionSets: TKConditionsSets<'contactField'> = [];
    // RulesFile type can't type each of its condition sets based do the action type :-(
    const conditionSets = permissionRules[action] as TKConditionsSets<'contactField'>;
    for (const conditionSet of conditionSets) {
      const fieldConditions = conditionSet.filter(
        r =>
          typeof r === 'object' &&
          typeof (r as ContactFieldSpecificCondition).field === 'string',
      );
      if (fieldConditions.length > 1) {
        console.error(
          'Invalid permission configuration. Multiple field conditions in a single condition set are not valid. Bottom level condition sets have AND logic, having 2 fields here means a field being checked needs to be 2 different fields at the same time. This condition set will always evaluate false',
          'action:',
          action,
          'condition set: ',
          conditionSet,
        );
      } else if (fieldConditions.length === 1) {
        const fieldCondition = fieldConditions[0] as ContactFieldSpecificCondition;
        conditionSetsByField[fieldCondition.field] =
          conditionSetsByField[fieldCondition.field] || [];
        conditionSetsByField[fieldCondition.field].push(
          conditionSet.filter(r => fieldCondition !== r),
        );
      } else {
        globalConditionSets.push(conditionSet);
      }
    }

    // If there is a global check that passes, no fields will be excluded
    // So we can just return an empty set
    if (
      checkConditionsSets(
        generateConditionState(globalConditionSets),
        globalConditionSets,
      )
    ) {
      return {};
    }

    const excludedFields: Record<string, string[]> = {};
    for (const [field, fieldConditionSets] of Object.entries(conditionSetsByField)) {
      const conditionsState = generateConditionState(fieldConditionSets);
      if (!checkConditionsSets(conditionsState, fieldConditionSets)) {
        const [, formName, fieldName] = field.split('.');
        excludedFields[formName] = excludedFields[formName] || [];
        excludedFields[formName].push(fieldName);
      }
    }
    return excludedFields;
  };

export const removeNonPermittedFieldsFromContact = (
  user: TwilioUser,
  permissionRules: RulesFile,
  contact: NewContactRecord | Contact,
  forWriting: boolean,
) => {
  // Filter out any fields in the forms that this user isn't permitted to update
  const writeExclusions = getExcludedFields(permissionRules)(
    contact,
    user,
    forWriting ? 'editContactField' : 'viewContactField',
  );
  for (const [exclusionForm, exclusionFields] of Object.entries(writeExclusions)) {
    for (const exclusionField of exclusionFields) {
      if (
        contact.rawJson?.[exclusionForm] &&
        exclusionField in contact.rawJson[exclusionForm]
      ) {
        delete contact.rawJson[exclusionForm][exclusionField];
      }
    }
  }
};

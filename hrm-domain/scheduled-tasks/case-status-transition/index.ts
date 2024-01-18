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

import { findSsmParametersByPath } from './ssmByPath';
import { CaseStatusTransitionRule } from './caseStatusTransitionRule';
import { applyTransitionRuleToCases } from './dataAccess';
import { AccountSID } from '@tech-matters/types';

const accountSidPattern =
  /\/[A-Za-z]+\/hrm\/(?<accountSid>AC\w+)\/case_status_transition_rules/;
/**
 * Cleanup all pending cleanup jobs
 * @returns void
 * @throws ContactJobCleanupError
 */
export const transitionCaseStatuses = async (): Promise<void> => {
  const parameters = await findSsmParametersByPath(
    `/${process.env.NODE_ENV}/hrm/*/case_status_transition_rules`,
  );
  const configs = parameters.map(({ Name, Value }) => {
    const accountSid = Name.match(accountSidPattern).groups.accountSid as AccountSID;
    return {
      accountSid,
      rules: JSON.parse(Value) as CaseStatusTransitionRule[],
    };
  });
  console.log(
    `Found automatic case status transition rules:`,
    configs.map(({ accountSid }) => accountSid),
  );

  for (const { accountSid, rules } of configs) {
    console.log(
      `Applying automatic case status transition rules for account:`,
      accountSid,
    );
    for (const rule of rules) {
      console.debug(`Applying rule to ${accountSid}:`, rule);
      const ids = await applyTransitionRuleToCases(accountSid, rule);
      console.info(
        `Updated the following cases in ${accountSid} to '${rule.targetStatus}' status because they had been in '${rule.startingStatus}' for ${rule.timeInStatusInterval}:`,
        ids,
      );
    }
  }
};

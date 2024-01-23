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
  /\/[A-Za-z]+\/[A-Za-z0-9\-]+\/hrm\/scheduled-task\/case-status-transition-rules\/(?<accountSid>AC\w+)/;
/**
 * Cleanup all pending cleanup jobs
 * @returns void
 * @throws ContactJobCleanupError
 */
export const transitionCaseStatuses = async (): Promise<void> => {
  console.info(
    `[scheduled-task:case-status-transition]: Starting automatic case status transition...`,
  );
  const parameters = await findSsmParametersByPath(
    `/${process.env.NODE_ENV}/${
      process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION
    }/hrm/scheduled-task/case-status-transition-rules/*`,
  );
  const configs = parameters.map(({ Name, Value }) => {
    const accountSid = Name.match(accountSidPattern).groups.accountSid as AccountSID;
    return {
      accountSid,
      rules: JSON.parse(Value) as CaseStatusTransitionRule[],
    };
  });
  console.debug(
    `[scheduled-task:case-status-transition]: Found automatic case status transition rules:`,
    configs.map(({ accountSid }) => accountSid),
  );

  for (const { accountSid, rules } of configs) {
    console.debug(
      `[scheduled-task:case-status-transition]: Applying automatic case status transition rules for account:`,
      accountSid,
    );
    for (const rule of rules) {
      console.debug(
        `[scheduled-task:case-status-transition]: Applying rule '${rule.description}' to ${accountSid}:`,
        rule,
      );
      const ids = await applyTransitionRuleToCases(accountSid, rule);
      console.info(
        `[scheduled-task:case-status-transition]: Updated the following cases in ${accountSid} to '${rule.targetStatus}' status because they had been in '${rule.startingStatus}' for ${rule.timeInStatusInterval}:`,
        ids,
      );
    }
  }
};

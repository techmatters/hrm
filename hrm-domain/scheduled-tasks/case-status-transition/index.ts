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

import { getSsmParameter } from '@tech-matters/ssm-cache';

/**
 * Apply the transition rule to any qualifying cases in the DB
 * @param rule
 * @returns void
 * @throws ContactJobCleanupError
 */
export const applyTransitionRuleToCases = async (rule): Promise<void> => {
  console.log(rule);
};

/**
 * Get the number of days to retain cleanup jobs for a given account
 * @param accountSid
 * @returns number of days to retain cleanup jobs
 */
const getCaseStatusTransitionRules = async (accountSid): Promise<any[]> => {
  const rulesParameterText = await getSsmParameter(
    `/${process.env.NODE_ENV}/hrm/${accountSid}/case_status_transition_rules`,
  );
  return rulesParameterText.split(';').map(singleRuleText => {
    const [startingStatus, targetStatus, timeInStatusUnit, timeInStatusValue] =
      singleRuleText.split(',');
    return {
      startingStatus,
      targetStatus,
      timeInStatusUnit,
      timeInStatusValue: parseInt(timeInStatusValue),
    };
  });
};

/**
 * Cleanup all pending cleanup jobs
 * @returns void
 * @throws ContactJobCleanupError
 */
export const transitionCaseStatuses = async (): Promise<void> => {
  const accountSids = ['placeholder'];

  console.log(`Cleaning up contact jobs for accounts:`, accountSids);

  for (const accountSid of accountSids) {
    const rules = await getCaseStatusTransitionRules(accountSid);
    for (const rule of rules) {
      await applyTransitionRuleToCases(rule);
    }
  }
};

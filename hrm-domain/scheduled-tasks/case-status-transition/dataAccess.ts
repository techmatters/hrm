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

import { db } from '@tech-matters/hrm-core/connection-pool';
import { CaseStatusTransitionRule } from './caseStatusTransitionRule';
import { AccountSID } from '@tech-matters/types';

/**
 * Apply the transition rule to any qualifying cases in the DB and returns the IDs of the cases that were updated
 * @param accountSid
 * @param rule
 * @returns void
 */
export const applyTransitionRuleToCases = async (
  accountSid: AccountSID,
  rule: CaseStatusTransitionRule,
): Promise<string[]> => {
  const records = await db.task(async conn => {
    return conn.manyOrNone<{ id: string }>(
      `UPDATE "Cases" 
                SET 
                "status" = $<targetStatus>, "statusUpdatedAt" = CURRENT_TIMESTAMP, "previousStatus" = "status",
                -- We set statusUpdatedAt to the rule that initiated the change rather than a user
                "statusUpdatedBy" = $<description> 
              WHERE 
                "accountSid"=$<accountSid> AND 
                "status" = $<startingStatus> AND 
                "statusUpdatedAt" < (CURRENT_TIMESTAMP - $<timeInStatusInterval>::interval) 
              RETURNING "id"`,
      { ...rule, accountSid },
    );
  });
  return records.map(record => record.id.toString());
};

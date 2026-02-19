import { newTwilioUser } from '@tech-matters/twilio-worker-auth';
import { openRules } from '../permissions/jsonPermissions';
import { TKConditionsSets } from '../permissions/rulesMap';

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

export const workerSid = 'WK-worker-sid';
export const accountSid = 'ACCOUNT_SID';

export const ALWAYS_CAN = {
  user: newTwilioUser(accountSid, workerSid, []),
  can: () => true,
  permissionRules: openRules,
  permissionCheckContact: undefined,
};

export const OPEN_CONTACT_ACTION_CONDITIONS: TKConditionsSets<'contact'> = [['everyone']];

export const OPEN_CASE_ACTION_CONDITIONS: TKConditionsSets<'case'> =
  OPEN_CONTACT_ACTION_CONDITIONS as TKConditionsSets<'case'>;

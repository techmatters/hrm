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

import { TwilioUser } from '@tech-matters/twilio-worker-auth';
import { ActionsOnTargetKind, TargetKind, TargetKindWithActions } from './actions';
import { setupCanForRules } from './setupCanForRules';
import { getContactById } from '../contact/contact';
import { getCase as getCaseById } from '../case/case';
import { assertExhaustive } from '../contact-job/assertExhaustive';

export const canPerformActionsOnObject = async <T extends TargetKind>({
  accountSid,
  targetKind,
  actions,
  objectId,
  can,
  user,
}: {
  accountSid: string;
  objectId: number;
  can: ReturnType<typeof setupCanForRules>;
  user: TwilioUser;
} & TargetKindWithActions<T>) => {
  switch (targetKind) {
    case 'contact': {
      const object = await getContactById(accountSid, objectId);

      return (<ActionsOnTargetKind<'contact'>[]>actions).every(action =>
        can(user, action, object),
      );
    }
    case 'case': {
      const object = await getCaseById(objectId, accountSid, { can, user });

      return (<ActionsOnTargetKind<'case'>[]>actions).every(action =>
        can(user, action, object),
      );
    }
    case 'postSurvey': {
      // Nothing from the target param is being used for postSurvey target kind, we can pass null for now
      return (<ActionsOnTargetKind<'postSurvey'>[]>actions).every(action =>
        can(user, action, null),
      );
    }
    default: {
      assertExhaustive(targetKind);
    }
  }
};

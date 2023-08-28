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
import { TargetKind, isValidSetOfActionsForTarget } from './actions';
import { setupCanForRules } from './setupCanForRules';
import { getContactById } from '../contact/contact';
import { getCase as getCaseById } from '../case/case';
import { assertExhaustive } from '../contact-job/assertExhaustive';
import {
  getConversationMediaByContactId,
  isS3StoredTranscript,
} from '../conversation-media/conversation-media';
import { Result, newErrorResult, newSuccessResult } from '@tech-matters/types';

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
  targetKind: T;
  actions: string[];
  can: ReturnType<typeof setupCanForRules>;
  user: TwilioUser;
}): Promise<Result<true>> => {
  try {
    if (!isValidSetOfActionsForTarget(targetKind, actions)) {
      return newErrorResult({
        message: 'invalid actions for objectType',
        statusCode: 400,
      });
    }

    switch (targetKind) {
      case 'contact': {
        const object = await getContactById(accountSid, objectId);

        const canPerform = actions.every(action => can(user, action, object));

        return canPerform
          ? newSuccessResult({ data: canPerform })
          : newErrorResult({ message: 'Not allowed', statusCode: 403 });
      }
      case 'case': {
        const object = await getCaseById(objectId, accountSid, { can, user });

        const canPerform = actions.every(action => can(user, action, object));

        return canPerform
          ? newSuccessResult({ data: canPerform })
          : newErrorResult({ message: 'Not allowed', statusCode: 403 });
      }
      case 'postSurvey': {
        // Nothing from the target param is being used for postSurvey target kind, we can pass null for now
        const canPerform = actions.every(action => can(user, action, null));

        return canPerform
          ? newSuccessResult({ data: canPerform })
          : newErrorResult({ message: 'Not allowed', statusCode: 403 });
      }
      default: {
        assertExhaustive(targetKind);
      }
    }
  } catch (err) {
    return newErrorResult({ message: (err as Error).message });
  }
};

export const isValidFileLocation = async ({
  accountSid,
  targetKind,
  objectId,
  bucket,
  key,
}: {
  accountSid: string;
  targetKind: TargetKind;
  objectId: number;
  bucket: string;
  key: string;
}): Promise<Result<true>> => {
  try {
    switch (targetKind) {
      case 'contact': {
        const conversationMedia = await getConversationMediaByContactId(
          accountSid,
          objectId,
        );

        const isValid = conversationMedia.some(
          cm =>
            isS3StoredTranscript(cm) &&
            cm.storeTypeSpecificData?.location?.bucket === bucket &&
            cm.storeTypeSpecificData?.location?.key === key,
        );

        return isValid
          ? newSuccessResult({ data: isValid })
          : newErrorResult({ message: 'Not allowed', statusCode: 403 });
      }
      case 'case': {
        return newErrorResult({ message: 'Not allowed', statusCode: 403 });
      }
      case 'postSurvey': {
        return newErrorResult({ message: 'Not allowed', statusCode: 403 });
      }
      default: {
        assertExhaustive(targetKind);
      }
    }
  } catch (err) {
    return newErrorResult({ message: (err as Error).message });
  }
};

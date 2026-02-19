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
import { Actions, TargetKind, isValidSetOfActionsForTarget } from './actions';
import { InitializedCan } from './initializeCanForRules';
import { getContactById } from '../contact/contactService';
import { getCase as getCaseById } from '../case/caseService';
import { assertExhaustive } from '@tech-matters/types';
import {
  getConversationMediaByContactId,
  isS3StoredConversationMedia,
} from '../conversation-media/conversationMedia';
import { TResult, newErr, newOk, HrmAccountId } from '@tech-matters/types';

export const canPerformActionsOnObject = async <T extends TargetKind>({
  hrmAccountId,
  targetKind,
  actions,
  objectId,
  can,
  user,
}: {
  hrmAccountId: HrmAccountId;
  objectId: string;
  targetKind: T;
  actions: string[];
  can: InitializedCan;
  user: TwilioUser;
}): Promise<TResult<'InvalidObjectType' | 'InternalServerError', boolean>> => {
  try {
    if (!isValidSetOfActionsForTarget(targetKind, actions)) {
      return newErr({
        message: 'invalid actions for objectType',
        error: 'InvalidObjectType',
        extraProperties: {
          targetKind,
          actions,
        },
      });
    }

    switch (targetKind) {
      case 'contact': {
        const object = await getContactById(hrmAccountId, objectId, { can, user });

        const canPerform = actions.every(action => can(user, action, object));

        return newOk({ data: canPerform });
      }
      case 'contactField': {
        return newErr({
          message: 'Not Implemented',
          error: 'InternalServerError',
          extraProperties: {
            errorObject: new Error('Not Implemented'),
          },
        });
      }
      case 'case': {
        const object = await getCaseById(objectId, hrmAccountId, {
          user,
        });

        const canPerform = actions.every(action => can(user, action, object));

        return newOk({ data: canPerform });
      }
      case 'profile': {
        return newErr({
          message: 'Not Implemented',
          error: 'InternalServerError',
          extraProperties: {
            errorObject: new Error('Not Implemented'),
          },
        });
      }
      case 'profileSection': {
        return newErr({
          message: 'Not Implemented',
          error: 'InternalServerError',
          extraProperties: {
            errorObject: new Error('Not Implemented'),
          },
        });
      }
      case 'postSurvey': {
        // Nothing from the target param is being used for postSurvey target kind, we can pass null for now
        const canPerform = actions.every(action => can(user, action, null));

        return newOk({ data: canPerform });
      }
      default: {
        assertExhaustive(targetKind);
      }
    }
  } catch (err) {
    const error = err as Error;
    return newErr({
      message: error.message,
      error: 'InternalServerError',
      extraProperties: {
        errorObject: error,
      },
    });
  }
};

export const isFilesRelatedAction = (targetKind: TargetKind, action: Actions) => {
  switch (targetKind) {
    case 'contact': {
      return action === 'viewExternalTranscript' || action === 'viewRecording';
    }
    case 'case':
    case 'contactField':
    case 'profile':
    case 'profileSection':
    case 'postSurvey': {
      return false;
    }
    default: {
      assertExhaustive(targetKind);
    }
  }
};

export const isValidFileLocation = async ({
  hrmAccountId,
  targetKind,
  objectId,
  bucket,
  key,
}: {
  hrmAccountId: HrmAccountId;
  targetKind: TargetKind;
  objectId: string;
  bucket: string;
  key: string;
}): Promise<TResult<'InternalServerError', boolean>> => {
  try {
    switch (targetKind) {
      case 'contact': {
        const conversationMedia = await getConversationMediaByContactId(
          hrmAccountId,
          parseInt(objectId),
        );

        const isValid = conversationMedia.some(
          cm =>
            isS3StoredConversationMedia(cm) &&
            cm.storeTypeSpecificData?.location?.bucket === bucket &&
            cm.storeTypeSpecificData?.location?.key === key,
        );

        return newOk({ data: isValid });
      }
      case 'case':
      case 'contactField':
      case 'profile':
      case 'profileSection':
      case 'postSurvey': {
        return newOk({ data: false });
      }
      default: {
        assertExhaustive(targetKind);
      }
    }
  } catch (error) {
    return newErr({
      message: (error as Error).message,
      error: 'InternalServerError',
    });
  }
};

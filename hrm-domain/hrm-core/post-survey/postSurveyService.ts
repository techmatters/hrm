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

import {
  create,
  filterByContactTaskId,
  NewPostSurvey,
  PostSurvey,
  upsertByTaskId,
} from './postSurveyDataAccess';
import {
  ErrorResult,
  HrmAccountId,
  newErr,
  newOkFromData,
  Result,
} from '@tech-matters/types';
import { getByTaskSid } from '../contact/contactDataAccess';
import { contactRecordToContact } from '../contact/contactService';
import { publishContactChangeNotification } from '../notifications/entityChangeNotify';

// The contact payload includes its post surveys, so it needs republishing when one is added.
// If the contact doesn't exist yet, its own create notification will include the survey.
const notifyContactOfPostSurvey = async (
  accountSid: HrmAccountId,
  { contactTaskId }: NewPostSurvey,
) => {
  try {
    const contact = await getByTaskSid(accountSid, contactTaskId);
    if (contact) {
      await publishContactChangeNotification({
        accountSid,
        contact: contactRecordToContact(contact),
        operation: 'update',
      });
    }
  } catch (err) {
    console.error(
      `Error trying to notify contact of post survey: accountSid ${accountSid} contactTaskId ${contactTaskId}`,
      err,
    );
  }
};

export const createPostSurvey = async (
  accountSid: HrmAccountId,
  postSurvey: NewPostSurvey,
): Promise<PostSurvey> => {
  const created = await create(accountSid, postSurvey);
  await notifyContactOfPostSurvey(accountSid, postSurvey);
  return created;
};

export const upsertPostSurvey = async (
  accountSid: HrmAccountId,
  postSurvey: NewPostSurvey,
): Promise<Result<ErrorResult<'InvalidParameterError'>, PostSurvey>> => {
  if (!postSurvey.contactTaskId) {
    return newErr({
      error: 'InvalidParameterError',
      message: `contactTaskId is required to save post survey for task ${postSurvey.taskId}`,
    });
  }
  const saved = await upsertByTaskId(accountSid, postSurvey);
  await notifyContactOfPostSurvey(accountSid, postSurvey);
  return newOkFromData(saved);
};

export const getPostSurveysByContactTaskId = async (
  accountSid: HrmAccountId,
  contactTaskId: string,
): Promise<PostSurvey[]> => filterByContactTaskId(accountSid, contactTaskId);

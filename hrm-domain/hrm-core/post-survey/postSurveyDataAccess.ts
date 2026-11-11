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

import { NewPostSurvey, PostSurvey } from '@tech-matters/hrm-types';
import { SELECT_POST_SURVEYS_BY_CONTACT_TASK } from './sql/postSurveyGetSql';
import { insertPostSurveySql } from './sql/postSurveyInsertSql';
import { UPDATE_POST_SURVEY_DATA_BY_TASK_ID } from './sql/postSurveyUpdateSql';
import { getDbForAccount } from '../dbConnection';

export type { NewPostSurvey, PostSurvey };

export const filterByContactTaskId = async (
  accountSid: string,
  contactTaskId: string,
): Promise<PostSurvey[]> =>
  (await getDbForAccount(accountSid)).task(async connection =>
    connection.manyOrNone(SELECT_POST_SURVEYS_BY_CONTACT_TASK, {
      accountSid,
      contactTaskId,
    }),
  );

export const create = async (
  accountSid: string,
  postSurvey: NewPostSurvey,
): Promise<PostSurvey> => {
  const now = new Date();
  return (await getDbForAccount(accountSid)).task(async connection =>
    connection.one<PostSurvey>(
      insertPostSurveySql({ ...postSurvey, updatedAt: now, createdAt: now, accountSid }),
    ),
  );
};

export type PostSurveyUpsert = Omit<NewPostSurvey, 'contactTaskId'> & {
  contactTaskId?: string;
};

/**
 * Replaces the data of the post survey(s) with this taskId, or creates one if none exist.
 * Returns undefined if there is nothing to update and it can't be created because contactTaskId is missing.
 */
export const upsertByTaskId = async (
  accountSid: string,
  { taskId, contactTaskId, data }: PostSurveyUpsert,
): Promise<PostSurvey | undefined> => {
  const now = new Date();
  return (await getDbForAccount(accountSid)).tx(async connection => {
    const [updated] = await connection.manyOrNone<PostSurvey>(
      UPDATE_POST_SURVEY_DATA_BY_TASK_ID,
      { accountSid, taskId, data, updatedAt: now },
    );
    if (updated) return updated;
    if (!contactTaskId) return undefined;
    return connection.one<PostSurvey>(
      insertPostSurveySql({
        contactTaskId,
        taskId,
        data,
        updatedAt: now,
        createdAt: now,
        accountSid,
      }),
    );
  });
};

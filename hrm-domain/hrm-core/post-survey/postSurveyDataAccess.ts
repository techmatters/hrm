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

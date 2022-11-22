import { db } from '../connection-pool';
import { SELECT_POST_SURVEYS_BY_CONTACT_TASK } from './sql/post-survey-get-sql';
import { insertPostSurveySql } from './sql/post-survey-insert-sql';

export type NewPostSurvey = {
  contactTaskId: string;
  taskId: string;
  data: Record<string, any>;
};

export type PostSurvey = NewPostSurvey & {
  id: string;
  createdAt: Date;
  updatedAt: Date;
};

export const filterByContactTaskId = async (
  accountSid: string,
  contactTaskId: string,
): Promise<PostSurvey[]> =>
  db.task(async connection =>
    connection.manyOrNone(SELECT_POST_SURVEYS_BY_CONTACT_TASK, { accountSid, contactTaskId }),
  );

export const create = (accountSid: string, postSurvey: NewPostSurvey): Promise<PostSurvey> => {
  const now = new Date();
  return db.task(async connection =>
    connection.one<PostSurvey>(
      insertPostSurveySql({ ...postSurvey, updatedAt: now, createdAt: now, accountSid }),
    ),
  );
};

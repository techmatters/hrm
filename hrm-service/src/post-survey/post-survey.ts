import {
  create,
  filterByContactTaskId,
  NewPostSurvey,
  PostSurvey,
} from './post-survey-data-access';

export const createPostSurvey = async (
  accountSid: string,
  postSurvey: NewPostSurvey,
): Promise<PostSurvey> => create(accountSid, postSurvey);

export const getPostSurveysByContactTaskId = async (
  accountSid: string,
  contactTaskId: string,
): Promise<PostSurvey[]> => filterByContactTaskId(accountSid, contactTaskId);

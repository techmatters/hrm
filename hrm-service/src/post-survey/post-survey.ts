import { NewPostSurvey, PostSurvey } from './post-survey-data-access';

const models = require('../models');
const { PostSurvey } = models;
const PostSurveyController = require('../controllers/post-survey-controller')(PostSurvey);

export const createPostSurvey = async (accountSid: string, postSurvey: NewPostSurvey): Promise<PostSurvey> => {
   return PostSurveyController.createPostSurvey(postSurvey, accountSid);
}

export const getPostSurveysByContactTaskId = async (accountSid: string, contactTaskId: string): Promise<PostSurvey[]> => {
  return PostSurveyController.getPostSurveysByContactTaskId(contactTaskId, accountSid);
}
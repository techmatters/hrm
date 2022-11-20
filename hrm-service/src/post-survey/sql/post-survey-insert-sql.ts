import { NewPostSurvey } from '../post-survey-data-access';
import { pgp } from '../../connection-pool';

export const insertPostSurveySql = (
  postSurvey: NewPostSurvey & { accountSid: string; createdAt: Date; updatedAt: Date },
) => `
${pgp.helpers.insert(
  postSurvey,
  ['contactTaskId', 'accountSid', 'taskId', 'data', 'createdAt', 'updatedAt'],
  'PostSurveys',
)}
  RETURNING *
`;

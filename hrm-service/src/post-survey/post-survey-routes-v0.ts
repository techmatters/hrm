// eslint-disable-next-line prettier/prettier
import type { Request, Response } from 'express';
import { SafeRouter, publicEndpoint, actionsMaps, RequestWithPermissions } from '../permissions';
import { NewPostSurvey, PostSurvey } from './post-survey-data-access';
import { createPostSurvey, getPostSurveysByContactTaskId } from './post-survey';

const postSurveysRouter = SafeRouter();

postSurveysRouter.post('/', publicEndpoint, async (
  req: Request<NewPostSurvey>,
  res: Response<PostSurvey>,
) => {
  const { accountSid } = req;

  const createdPostSurvey = await createPostSurvey(accountSid, req.body);
  res.json(createdPostSurvey);
});

const canViewPostSurvey = (req: RequestWithPermissions, res, next) => {
  if (!req.isAuthorized()) {
    const { user, can } = req;

    // Nothing from the target param is being used for postSurvey target kind, we can pass null for now
    if (can(user, actionsMaps.postSurvey.VIEW_POST_SURVEY, null)) {
      req.authorize();
    } else {
      req.unauthorize();
    }
  }

  next();
};

postSurveysRouter.get('/contactTaskId/:id', canViewPostSurvey, async (
  req: Request,
  res: Response,
) => {
  const { accountSid } = req;
  const { id } = req.params;

  const postSurveys = await getPostSurveysByContactTaskId(accountSid, id);
  res.json(postSurveys);
});

export default postSurveysRouter.expressRouter;
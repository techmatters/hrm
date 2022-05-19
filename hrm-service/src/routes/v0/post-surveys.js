const models = require('../../models');
const { SafeRouter, publicEndpoint, actionsMaps } = require('../../permissions');

const { PostSurvey } = models;
const PostSurveyController = require('../../controllers/post-survey-controller')(PostSurvey);

const postSurveysRouter = SafeRouter();

postSurveysRouter.post('/', publicEndpoint, async (
  /** @type {import('express').Request} */ req,
  /** @type {import('express').Response} */ res,
) => {
  const { accountSid } = req;

  const createdPostSurvey = await PostSurveyController.createPostSurvey(req.body, accountSid);
  res.json(createdPostSurvey);
});

const canViewPostSurvey = (req, res, next) => {
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
  /** @type {import('express').Request} */ req,
  /** @type {import('express').Response} */ res,
) => {
  const { accountSid } = req;
  const { id } = req.params;

  const postSurveys = await PostSurveyController.getPostSurveysByContactTaskId(id, accountSid);
  res.json(postSurveys);
});

module.exports = postSurveysRouter.expressRouter;

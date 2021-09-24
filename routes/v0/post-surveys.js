const models = require('../../models');
const { SafeRouter, publicEndpoint, canViewPostSurvey } = require('../../permissions');

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

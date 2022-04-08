const Actions = require('./actions');
const { asyncHandler } = require('../utils');
const models = require('../models');
const { getById } = require('../case/case-data-access');
const { PostSurvey, Case } = models;

/**
 * It checks if the user can edit the case based on the fields it's trying to edit
 * according to the defined permission rules.
 */
const canEditCase = asyncHandler(async (req, res, next) => {
  if (!req.isAuthorized()) {
    const { accountSid, body, user, can } = req;
    const { id } = req.params;
    const caseObj = await getById(id, accountSid);
    const caseModel = new Case(caseObj);
    const actions = Actions.getActions(caseModel, body);
    const canEdit = actions.every(action => can(user, action, caseObj));

    if (canEdit) {
      req.authorize();
    } else {
      req.unauthorize();
    }
  }

  next();
});

const canViewPostSurvey = (req, res, next) => {
  if (!req.isAuthorized()) {
    const { user, can } = req;

    if (can(user, Actions.actionsMaps.postSurvey.VIEW_POST_SURVEY, PostSurvey)) {
      req.authorize();
    } else {
      req.unauthorize();
    }
  }

  next();
};

module.exports = { canEditCase, canViewPostSurvey };

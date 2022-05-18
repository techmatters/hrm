const Actions = require('./actions');
const { asyncHandler } = require('../utils');
const { getById: getCaseById } = require('../case/case-data-access');
const { getById: getContactById } = require('../contact/contact-data-access');
const createError = require('http-errors');

/**
 * It checks if the user can edit the case based on the fields it's trying to edit
 * according to the defined permission rules.
 */
const canEditCase = asyncHandler(async (req, res, next) => {
  if (!req.isAuthorized()) {
    const { accountSid, body, user, can } = req;
    const { id } = req.params;
    const caseObj = await getCaseById(id, accountSid);

    if (!caseObj) throw createError(404);

    const actions = Actions.getActions(caseObj, body);
    const canEdit = actions.every(action => can(user, action, caseObj));

    if (canEdit) {
      req.authorize();
    } else {
      req.unauthorize();
    }
  }

  next();
});

const canEditContact = asyncHandler(async (req, res, next) => {
  if (!req.isAuthorized()) {
    const { accountSid, user, can } = req;
    const { contactId } = req.params;

    const contactObj = await getContactById(accountSid, contactId);

    if (!contactObj) throw createError(404);

    if (can(user, Actions.actionsMaps.contact.EDIT_CONTACT, contactObj)) {
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

    // Nothing from the target param is being used for postSurvey target kind, we can pass null for now
    if (can(user, Actions.actionsMaps.postSurvey.VIEW_POST_SURVEY, null)) {
      req.authorize();
    } else {
      req.unauthorize();
    }
  }

  next();
};

module.exports = { canEditCase, canEditContact, canViewPostSurvey };

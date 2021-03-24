const { getActions } = require('./actions');
const { asyncHandler } = require('../utils');
const models = require('../models');

const { Case, sequelize } = models;
const CaseController = require('../controllers/case-controller')(Case, sequelize);

const canEditCase = asyncHandler(async (req, res, next) => {
  if (!req.isAuthorized()) {
    const { accountSid, body, user, can } = req;
    const { id } = req.params;
    const caseObj = await CaseController.getCase(id, accountSid);
    const actions = getActions(caseObj.dataValues, body);
    const canEdit = actions.every(action => can(user, action, caseObj));

    if (canEdit) {
      req.authorize();
    } else {
      req.unauthorize();
    }
  }

  next();
});

module.exports = { canEditCase };

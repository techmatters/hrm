const { getActions } = require('./actions');
const { asyncHandler } = require('../utils');
const models = require('../models');

const { Case, sequelize } = models;
const CaseController = require('../controllers/case-controller')(Case, sequelize);

const canEditCase = asyncHandler(async (req, res, next) => {
  if (!req.isAuthorized()) {
    const { accountSid, body } = req;
    const { id } = req.params;
    const caseObj = await CaseController.getCase(id, accountSid);
    const actions = getActions(caseObj.dataValues, body);
    const canEdit = req.can(req.user, 'edit', caseObj, { actions });

    if (canEdit) {
      req.authorize();
    } else {
      req.unauthorize();
    }
  }

  next();
});

module.exports = { canEditCase };

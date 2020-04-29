const createError = require('http-errors');

const CaseController = Case => {
  const createCase = async body => {
    const caseRecord = {
      info: body.info,
      helpline: body.helpline,
      status: body.status || 'open',
    };

    const createdCase = await Case.create(caseRecord);
    return createdCase;
  };

  const getCase = async id => {
    const caseFromDB = await Case.findByPk(id);

    if (!caseFromDB) {
      const errorMessage = `Case with id ${id} not found`;
      throw createError(404, errorMessage);
    }

    return caseFromDB;
  };

  const listCases = async query => {
    const queryObject = {
      order: [['createdAt', 'DESC']],
      where: {
        helpline: query.helpline || '',
      },
    };

    const cases = await Case.findAll(queryObject);
    return cases;
  };

  const updateCase = async (id, body) => {
    const caseFromDB = await getCase(id);
    const updatedCase = await caseFromDB.update(body);
    return updatedCase;
  };

  return { createCase, getCase, listCases, updateCase };
};

module.exports = CaseController;

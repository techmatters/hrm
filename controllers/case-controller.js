const createError = require('http-errors');
const { retrieveCategories } = require('./helpers');

const CaseController = Case => {
  const createCase = async body => {
    const caseRecord = {
      info: body.info,
      helpline: body.helpline,
      status: body.status || 'open',
      twilioWorkerId: body.twilioWorkerId,
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
    const withContactInfo = await Promise.all(
      cases.map(async caseItem => {
        const fstContact = (await caseItem.getContacts())[0];

        if (!fstContact)
          return { ...caseItem.dataValues, childName: '', callSummary: '', categories: [] };

        const { childInformation, caseInformation } = fstContact.dataValues.rawJson;
        const childName = `${childInformation.name.firstName} ${childInformation.name.lastName}`;
        const { callSummary } = caseInformation;
        const categories = retrieveCategories(caseInformation.categories);
        return { ...caseItem.dataValues, childName, callSummary, categories };
      }),
    );

    return withContactInfo;
  };

  const updateCase = async (id, body) => {
    const caseFromDB = await getCase(id);
    const updatedCase = await caseFromDB.update(body);
    return updatedCase;
  };

  return { createCase, getCase, listCases, updateCase };
};

module.exports = CaseController;

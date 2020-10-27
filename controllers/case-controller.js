const createError = require('http-errors');
const { retrieveCategories, getPaginationElements } = require('./helpers');

const CaseController = Case => {
  const createCase = async body => {
    const options = { include: { association: 'connectedContacts' } };
    const caseRecord = {
      info: body.info,
      helpline: body.helpline,
      status: body.status || 'open',
      twilioWorkerId: body.twilioWorkerId,
      connectedContacts: [],
    };

    const createdCase = await Case.create(caseRecord, options);
    return createdCase;
  };

  const getCase = async id => {
    const options = { include: { association: 'connectedContacts' } };
    const caseFromDB = await Case.findByPk(id, options);

    if (!caseFromDB) {
      const errorMessage = `Case with id ${id} not found`;
      throw createError(404, errorMessage);
    }

    return caseFromDB;
  };

  const listCases = async query => {
    const { limit, offset } = getPaginationElements(query);

    const queryObject = {
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      include: { association: 'connectedContacts', required: true },
    };
    if (query.helpline) {
      queryObject.where = {
        helpline: query.helpline,
      };
    }

    const { count, rows } = await Case.findAndCountAll(queryObject);
    const cases = rows.map(caseItem => {
      const fstContact = caseItem.connectedContacts[0];

      if (!fstContact) {
        return {
          ...caseItem.dataValues,
          childName: '',
          categories: retrieveCategories(undefined), // we call the function here so the return value allways matches
        };
      }

      const { childInformation, caseInformation } = fstContact.dataValues.rawJson;
      const childName = `${childInformation.name.firstName} ${childInformation.name.lastName}`;
      const categories = retrieveCategories(caseInformation.categories);
      return { ...caseItem.dataValues, childName, categories };
    });

    return { cases, count };
  };

  const updateCase = async (id, body) => {
    const caseFromDB = await getCase(id);
    const updatedCase = await caseFromDB.update(body);
    return updatedCase;
  };

  const deleteCase = async id => {
    const caseFromDB = await getCase(id);
    await caseFromDB.destroy();
  };

  return { createCase, getCase, listCases, updateCase, deleteCase };
};

module.exports = CaseController;

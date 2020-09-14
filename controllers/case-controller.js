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
    const queryLimit =
      query.limit && !Number.isNaN(parseInt(query.limit, 10))
        ? parseInt(query.limit, 10)
        : Infinity;
    const limit = Math.min(queryLimit, 1000);
    const offset = (query.offset && parseInt(query.offset, 10)) || 0;
    const queryObject = {
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    };

    const { count, rows } = await Case.findAndCountAll(queryObject);
    const cases = await Promise.all(
      rows.map(async caseItem => {
        const fstContact = (await caseItem.getContacts())[0];

        if (!fstContact)
          return {
            ...caseItem.dataValues,
            childName: '',
            categories: retrieveCategories(undefined), // we call the function here so the return value allways matches
          };

        const { childInformation, caseInformation } = fstContact.dataValues.rawJson;
        const childName = `${childInformation.name.firstName} ${childInformation.name.lastName}`;
        const categories = retrieveCategories(caseInformation.categories);
        return { ...caseItem.dataValues, childName, categories };
      }),
    );

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

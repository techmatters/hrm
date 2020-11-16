const createError = require('http-errors');
const fs = require('fs');
const path = require('path');
const { retrieveCategories, getPaginationElements, isEmptySearchParams } = require('./helpers');

const searchCasesQuery = fs
  .readFileSync(path.join(__dirname, '../sql/search-cases-query.sql'))
  .toString();

const CaseController = (Case, sequelize) => {
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

  const searchCases = async (body, query) => {
    if (isEmptySearchParams(body)) {
      return { count: 0, contacts: [] };
    }

    const notDigits = /[\D]/gi;
    const casesWithTotalCount = await sequelize.query(searchCasesQuery, {
      type: sequelize.QueryTypes.SELECT,
      replacements: {
        helpline: body.helpline || null,
        firstName: body.firstName ? `%${body.firstName}%` : null,
        lastName: body.lastName ? `%${body.lastName}%` : null,
        dateFrom: body.dateFrom || null,
        dateTo: body.dateTo || null,
        phoneNumber: body.phoneNumber ? `%${body.phoneNumber.replace(notDigits, '')}%` : null,
        counselor: body.counselor || null,
        limit: query.limit,
        offset: query.offset,
      },
    });

    const count =
      casesWithTotalCount && casesWithTotalCount.length > 0 ? casesWithTotalCount[0].totalCount : 0;
    const cases = casesWithTotalCount
      ? casesWithTotalCount.map(({ totalCount, ...rest }) => ({ ...rest }))
      : [];

    return { count, cases };
  };

  return { createCase, getCase, listCases, updateCase, deleteCase, searchCases };
};

module.exports = CaseController;

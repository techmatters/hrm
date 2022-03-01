const createError = require('http-errors');
const Sequelize = require('sequelize');
const fs = require('fs');
const path = require('path');
const { isArray } = require('util');
const { retrieveCategories, getPaginationElements, isEmptySearchParams } = require('./helpers');

const { Op } = Sequelize;

const searchCasesQuery = fs
  .readFileSync(path.join(__dirname, '../sql/search-cases-query.sql'))
  .toString();

// DEPRECATE ME - This migration code should only be required until CHI-1040 is deployed to all flex instances
const migrateLegacyNotes = (model, update, twilioWorkerId) => {
  if (update.info) {
    const legacyNotes = isArray(update.info.cases) ? update.info.cases : [];
    const counsellorNotes = isArray(update.info.counsellorCases) ? update.info.counsellorCases : [];
    const dbNotes = isArray(model.info.counsellorCases) ? update.info.counsellorCases : [];

    // Assume if there are more new format notes in the update than in the DB, that this is the correct update
    // Otherwise, if there are more legacy notes that current notes in the DB, convert them to the new format & add them
    if (counsellorNotes.length <= dbNotes.length && legacyNotes.length > dbNotes.length) {
      return {
        ...update,
        info: {
          ...update.info,
          counsellorNotes: [
            ...dbNotes,
            ...legacyNotes
              .slice(dbNotes.length)
              .map(note => ({ note, twilioWorkerId, createdAt: new Date().toISOString() })),
          ],
        },
      };
    }
  }
  return update;
};

const CaseController = (Case, sequelize) => {
  const createCase = async (body, accountSid, workerSid) => {
    const options = {
      include: {
        association: 'connectedContacts',
        include: { association: 'csamReports' },
      },
      context: { workerSid },
    };
    const caseRecord = {
      info: body.info,
      helpline: body.helpline,
      status: body.status || 'open',
      twilioWorkerId: body.twilioWorkerId,
      createdBy: workerSid,
      connectedContacts: [],
      accountSid: accountSid || '',
    };

    return Case.create(caseRecord, options);
  };

  const getCase = async (id, accountSid) => {
    const options = {
      include: {
        association: 'connectedContacts',
        include: { association: 'csamReports' },
      },
      where: { [Op.and]: [{ id: id || null }, { accountSid }] },
    };
    const caseFromDB = await Case.findOne(options);

    if (!caseFromDB) {
      const errorMessage = `Case with id ${id} not found`;
      throw createError(404, errorMessage);
    }

    return caseFromDB;
  };

  const listCases = async (query, accountSid) => {
    const { limit, offset } = getPaginationElements(query);
    const { helpline } = query;

    const queryObject = {
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      include: {
        association: 'connectedContacts',
        include: { association: 'csamReports' },
        required: true,
      },
    };

    queryObject.where = {
      [Op.and]: [helpline && { helpline }, accountSid && { accountSid }],
    };

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

  const updateCase = async (id, body, accountSid, workerSid) => {
    const caseFromDB = await getCase(id, accountSid);
    const options = { context: { workerSid } };
    return caseFromDB.update(migrateLegacyNotes(caseFromDB, body, workerSid), options);
  };

  const deleteCase = async (id, accountSid) => {
    const caseFromDB = await getCase(id, accountSid);
    await caseFromDB.destroy();
  };

  const searchCases = async (body, query, accountSid) => {
    if (isEmptySearchParams(body)) {
      return { count: 0, contacts: [] };
    }

    const notDigits = /[\D]/gi;
    const casesWithTotalCount = await sequelize.query(searchCasesQuery, {
      type: sequelize.QueryTypes.SELECT,
      replacements: {
        accountSid,
        helpline: body.helpline || null,
        firstName: body.firstName ? `%${body.firstName}%` : null,
        lastName: body.lastName ? `%${body.lastName}%` : null,
        dateFrom: body.dateFrom || null,
        dateTo: body.dateTo || null,
        phoneNumber: body.phoneNumber ? `%${body.phoneNumber.replace(notDigits, '')}%` : null,
        counselor: body.counselor || null,
        contactNumber: body.contactNumber || null,
        closedCases: typeof body.closedCases === 'undefined' || body.closedCases,
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

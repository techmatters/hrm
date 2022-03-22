const createError = require('http-errors');
const Sequelize = require('sequelize');
const fs = require('fs');
const path = require('path');
const { isArray } = require('util');
const { retrieveCategories, getPaginationElements, isEmptySearchParams } = require('./helpers');

const { Op } = Sequelize;

const searchCasesQuery = fs
  .readFileSync(path.join(__dirname, '../../sql/search-cases-query.sql'))
  .toString();

// Checks for any notes that might have been added to legacy 'notes' property by an old version of the client and converts & copies them to the new 'counsellorNotes' property/
// DEPRECATE ME - This migration code should only be required until CHI-1040 is deployed to all flex instances
const migrateAddedLegacyNotesToCounsellorNotes = (
  update,
  twilioWorkerId,
  dbCase = { info: {} },
) => {
  if (update.info) {
    const legacyNotes = isArray(update.info.notes) ? update.info.notes : [];
    const counsellorNotes = isArray(update.info.counsellorNotes) ? update.info.counsellorNotes : [];
    const dbNotes = isArray(dbCase.info.counsellorNotes) ? dbCase.info.counsellorNotes : [];

    // Assume if there are more new format notes in the update than in the DB, that this is the correct update
    // Otherwise, if there are more legacy notes that current notes in the DB, convert them to the new format & add them
    if (counsellorNotes.length <= dbNotes.length && legacyNotes.length > dbNotes.length) {
      const migrated = {
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
      delete migrated.info.notes;
      return migrated;
    }
  }
  return update;
};

// Checks for any referrals that might be missing new properties because they were sent from legacy clients.
// DEPRECATE ME - This migration code should only be required until CHI-1040 is deployed to all flex instances
const fixLegacyReferrals = (update, twilioWorkerId, dbCase = {}) => {
  if (update.info && isArray(update.info.referrals)) {
    const modelReferrals = (dbCase.info || {}).referrals || [];
    return {
      ...update,
      info: {
        ...update.info,
        referrals: update.info.referrals.map((r, idx) => ({
          // Deliberately putting the new props first so existing ones will overwrite them
          twilioWorkerId: (modelReferrals[idx] || {}).twilioWorkerId || twilioWorkerId,
          createdAt: (modelReferrals[idx] || {}).createdAt || new Date().toISOString(),
          ...r,
        })),
      },
    };
  }
  return update;
};

// Copy the text content of the new 'counsellorNotes' property to the legacy 'notes' property.
// Not sure if anything actually reads the 'notes' property on the case info directly on the front end, or always reads them via the 'activities' endpoint
// But this function makes them backwards compatible just in case
// DEPRECATE ME - This migration code should only be required until CHI-1040 is deployed to all flex instances
const generateLegacyNotesFromCounsellorNotes = caseFromDb => {
  if (caseFromDb.info && caseFromDb.info.counsellorNotes) {
    return {
      ...caseFromDb,
      info: {
        ...caseFromDb.info,
        notes: isArray(caseFromDb.info.counsellorNotes)
          ? caseFromDb.info.counsellorNotes.map(n => n.note)
          : undefined,
      },
    };
  }
  return caseFromDb;
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
    const migratedBody = migrateAddedLegacyNotesToCounsellorNotes(
      fixLegacyReferrals(caseRecord, workerSid),
      workerSid,
    );

    return generateLegacyNotesFromCounsellorNotes(
      (await Case.create(migratedBody, options)).dataValues,
    );
  };

  // This method does NOT automatically add legacy notes because it is used internally
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
      return generateLegacyNotesFromCounsellorNotes({
        ...caseItem.dataValues,
        childName,
        categories,
      });
    });

    return { cases, count };
  };

  const updateCase = async (id, body, accountSid, workerSid) => {
    const caseFromDB = await getCase(id, accountSid);
    const options = { context: { workerSid } };
    const migratedBody = migrateAddedLegacyNotesToCounsellorNotes(
      fixLegacyReferrals(body, workerSid, caseFromDB.dataValues),
      workerSid,
      caseFromDB.dataValues,
    );
    return generateLegacyNotesFromCounsellorNotes(
      (await caseFromDB.update(migratedBody, options)).dataValues,
    );
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
      ? casesWithTotalCount.map(({ totalCount, ...rest }) =>
          generateLegacyNotesFromCounsellorNotes(rest),
        )
      : [];

    return { count, cases };
  };

  return { createCase, listCases, getCase, updateCase, deleteCase, searchCases };
};

module.exports = CaseController;

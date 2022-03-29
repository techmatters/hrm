/**
 * This is the 'business logic' module for Case CRUD operations.
 * For the moment it just does some light mapping between the types used for the REST layer, and the types used for the database layer.
 * This includes compatibility code required to provide cases in a shape expected by older clients
 */
import * as caseDb from './case-data-access';
import { retrieveCategories } from '../controllers/helpers';

type Case = CaseRecord & {
  childName?: string;
  categories: Record<string, string[]>;
};

type CaseRecord = caseDb.CaseRecord;

const addCategoriesAndChildName = (caseItem: CaseRecord): Case => {
  const fstContact = caseItem.connectedContacts[0];

  if (!fstContact) {
    return {
      ...caseItem,
      childName: '',
      categories: retrieveCategories(undefined), // we call the function here so the return value always matches
    };
  }

  const { childInformation, caseInformation } = fstContact.rawJson;
  const childName = `${childInformation.name.firstName} ${childInformation.name.lastName}`;
  const categories = retrieveCategories(caseInformation.categories);
  return { ...caseItem, childName, categories };
};

// Checks for any notes that might have been added to legacy 'notes' property by an old version of the client and converts & copies them to the new 'counsellorNotes' property/
// DEPRECATE ME - This migration code should only be required until CHI-1040 is deployed to all flex instances
const migrateAddedLegacyNotesToCounsellorNotes = (
  update,
  twilioWorkerId,
  dbCase: Partial<Case> = { info: {} },
) => {
  if (update.info) {
    const legacyNotes = Array.isArray(update.info.notes) ? update.info.notes : [];
    const counsellorNotes = Array.isArray(update.info.counsellorNotes)
      ? update.info.counsellorNotes
      : [];
    const dbNotes = Array.isArray(dbCase.info.counsellorNotes) ? dbCase.info.counsellorNotes : [];

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
const fixLegacyReferrals = (update, twilioWorkerId, dbCase: Partial<Case> = {}) => {
  if (update.info && Array.isArray(update.info.referrals)) {
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
        notes: Array.isArray(caseFromDb.info.counsellorNotes)
          ? caseFromDb.info.counsellorNotes.map(n => n.note)
          : undefined,
      },
    };
  }
  return caseFromDb;
};

export const createCase = async (body, accountSid, workerSid): Promise<CaseRecord> => {
  const migratedBody = migrateAddedLegacyNotesToCounsellorNotes(
    fixLegacyReferrals(body, workerSid),
    workerSid,
  );
  const created = await caseDb.create(migratedBody, accountSid, workerSid);
  return generateLegacyNotesFromCounsellorNotes(created);
};

export const updateCase = async (
  id,
  body: Partial<CaseRecord>,
  accountSid,
  workerSid,
): Promise<Case> => {
  const caseFromDB = await caseDb.getById(id, accountSid);
  if (!caseFromDB) {
    return;
  }
  const migratedBody = migrateAddedLegacyNotesToCounsellorNotes(
    fixLegacyReferrals(body, workerSid, caseFromDB),
    workerSid,
    caseFromDB,
  );
  return generateLegacyNotesFromCounsellorNotes(
    await caseDb.update(id, migratedBody, accountSid, workerSid),
  );
};

export const listCases = async (
  query: { helpline: string },
  accountSid,
): Promise<{ cases: readonly Case[]; count: number }> => {
  const dbResult = await caseDb.list(query, accountSid);
  return {
    ...dbResult,
    cases: dbResult.cases.map(c =>
      generateLegacyNotesFromCounsellorNotes(addCategoriesAndChildName(c)),
    ),
  };
};

export const searchCases = async (
  body,
  query: { helpline: string },
  accountSid,
): Promise<{ cases: readonly Case[]; count: number }> => {
  const dbResult = await caseDb.search(body, query, accountSid);
  return {
    ...dbResult,
    cases: dbResult.cases.map(c =>
      generateLegacyNotesFromCounsellorNotes(addCategoriesAndChildName(c)),
    ),
  };
};

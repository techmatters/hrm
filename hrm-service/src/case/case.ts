/**
 * This is the 'business logic' module for Case CRUD operations.
 * For the moment it just does some light mapping between the types used for the REST layer, and the types used for the database layer.
 * This includes compatibility code required to provide cases in a shape expected by older clients
 */
import * as caseDb from './case-data-access';
import { retrieveCategories } from '../controllers/helpers';
import {
  CaseListConfiguration,
  CaseListFilters,
  CaseRecordCommon,
  CaseSearchCriteria,
  CaseSectionRecord,
  NewCaseRecord,
} from './case-data-access';
import { randomUUID } from 'crypto';
import { Contact } from '../contact/contact-data-access';

type CaseInfoSection = {
  id: string;
  twilioWorkerId: string;
  updatedAt?: string;
  updatedBy?: string;
} & Record<string, any>;

const getSectionSpecificDataFromNotesOrReferrals = (
  caseSection: CaseInfoSection,
): Record<string, any> => {
  const { id, twilioWorkerId, createdAt, updatedBy, updatedAt, ...sectionSpecificData } =
    caseSection;
  return sectionSpecificData;
};

export const WELL_KNOWN_CASE_SECTION_NAMES: Record<
  string,
  { sectionTypeName: string; getSectionSpecificData: (section: any) => any }
> = {
  households: { getSectionSpecificData: s => s.household, sectionTypeName: 'household' },
  perpetrators: { getSectionSpecificData: s => s.perpetrator, sectionTypeName: 'perpetrator' },
  incidents: { getSectionSpecificData: s => s.incident, sectionTypeName: 'incident' },
  counsellorNotes: {
    getSectionSpecificData: getSectionSpecificDataFromNotesOrReferrals,
    sectionTypeName: 'note',
  },
  referrals: {
    getSectionSpecificData: getSectionSpecificDataFromNotesOrReferrals,
    sectionTypeName: 'referral',
  },
  documents: { getSectionSpecificData: s => s.document, sectionTypeName: 'document' },
};

export type Case = CaseRecordCommon & {
  id: number;
  childName?: string;
  categories: Record<string, string[]>;
  connectedContacts?: Contact[];
};
type CaseRecord = caseDb.CaseRecord;

/**
 * Converts a single list of all sections for a case to a set of arrays grouped by type
 */
const caseSectionRecordsToInfo = (
  sections: CaseSectionRecord[] = [],
): Record<string, CaseInfoSection[]> => {
  const infoLists: Record<string, CaseInfoSection[]> = {};
  return sections.reduce((categorized, record) => {
    const { caseId, sectionType, sectionId, sectionTypeSpecificData, createdBy, ...restOfRecord } =
      record;

    if (!restOfRecord.updatedAt) {
      delete restOfRecord.updatedAt;
    }
    if (!restOfRecord.updatedBy) {
      delete restOfRecord.updatedBy;
    }
    switch (record.sectionType) {
      case 'note':
        categorized.counsellorNotes = categorized.counsellorNotes ?? [];
        categorized.counsellorNotes.push({
          ...sectionTypeSpecificData,
          ...restOfRecord,
          id: sectionId,
          twilioWorkerId: createdBy,
        });
        break;
      case 'referral':
        categorized.referrals = categorized.referrals ?? [];
        categorized.referrals.push({
          ...sectionTypeSpecificData,
          ...restOfRecord,
          id: sectionId,
          twilioWorkerId: createdBy,
        });
        break;
      default:
        const listName = `${record.sectionType}s`;
        categorized[listName] = categorized[listName] ?? [];
        categorized[listName].push({
          ...restOfRecord,
          id: sectionId,
          twilioWorkerId: createdBy,
          [record.sectionType]: sectionTypeSpecificData,
        });
    }
    return categorized;
  }, infoLists);
};

const addCategoriesAndChildName = (caseItem: CaseRecord) => {
  const fstContact = (caseItem.connectedContacts ?? [])[0];

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

/**
 * Converts a case passed in from the API to a case record ready to write to the DB
 * @param inputCase
 * @param workerSid
 */
const caseToCaseRecord = (inputCase: Partial<Case>, workerSid: string): Partial<NewCaseRecord> => {
  const info = inputCase.info ?? {};
  const caseSections: CaseSectionRecord[] = Object.entries(WELL_KNOWN_CASE_SECTION_NAMES).flatMap(
    ([sectionName, { getSectionSpecificData, sectionTypeName }]) =>
      (info[sectionName] ?? []).map(section => {
        const caseSectionRecordToUpsert: CaseSectionRecord = {
          caseId: inputCase.id,
          sectionType: sectionTypeName,
          sectionId: section.id ?? randomUUID(),
          createdBy: section.twilioWorkerId ?? workerSid,
          createdAt: section.createdAt ?? new Date().toISOString(),
          updatedBy: section.updatedBy,
          updatedAt: section.updatedAt,
          sectionTypeSpecificData: getSectionSpecificData(section),
          accountSid: section.accountSid,
        };
        return caseSectionRecordToUpsert;
      }),
  );
  return {
    ...inputCase,
    caseSections,
  };
};

const caseRecordToCase = (record: CaseRecord): Case => {
  // Remove legacy case sections
  const info = {
    ...record.info,
  };
  Object.keys(WELL_KNOWN_CASE_SECTION_NAMES).forEach(k => delete info[k]);
  delete info.notes;

  const { caseSections, ...output } = addCategoriesAndChildName({
    ...record,
    info: {
      ...info,
      ...caseSectionRecordsToInfo(record.caseSections),
    },
  });

  return output;
};

export const createCase = async (
  body: Partial<Case>,
  accountSid: Case['accountSid'],
  workerSid: Case['twilioWorkerId'],
): Promise<Case> => {
  const nowISO = new Date().toISOString();
  delete body.id;
  const record = caseToCaseRecord(
    {
      ...body,
      createdBy: workerSid,
      createdAt: nowISO,
      updatedAt: nowISO,
      updatedBy: null,
      accountSid,
    },
    workerSid,
  );
  const created = await caseDb.create(record, accountSid);
  return caseRecordToCase(created);
};

export const updateCase = async (
  id: Case['id'],
  body: Partial<Case>,
  accountSid: Case['accountSid'],
  workerSid: Case['twilioWorkerId'],
): Promise<Case> => {
  const caseFromDB: CaseRecord = await caseDb.getById(id, accountSid);
  if (!caseFromDB) {
    return;
  }

  const nowISO = new Date().toISOString();

  const record = caseToCaseRecord(
    { ...body, updatedBy: workerSid, updatedAt: nowISO, id, accountSid },
    workerSid,
    // caseRecordToCase(caseFromDB),
  );

  return caseRecordToCase(await caseDb.update(id, record, accountSid));
};

export const getCase = async (id: number, accountSid: string): Promise<Case | undefined> => {
  const caseFromDb = await caseDb.getById(id, accountSid);
  if (caseFromDb) {
    return caseRecordToCase(caseFromDb);
  }
  return;
};

export type SearchParameters = CaseSearchCriteria & {
  filters?: CaseListFilters;
} & {
  helpline?: string;
  counselor?: string;
  closedCases?: boolean;
};

export const searchCases = async (
  accountSid,
  listConfiguration: CaseListConfiguration = {},
  search: SearchParameters = {},
): Promise<{ cases: readonly Case[]; count: number }> => {
  const { filters, helpline, counselor, closedCases, ...searchCriteria } = search;
  const caseFilters = filters ?? {};
  caseFilters.helplines = caseFilters.helplines ?? (helpline ? helpline.split(';') : undefined);
  caseFilters.counsellors =
    caseFilters.counsellors ?? (counselor ? counselor.split(';') : undefined);
  caseFilters.excludedStatuses = caseFilters.excludedStatuses ?? [];
  if (closedCases === false) {
    caseFilters.excludedStatuses.push('closed');
  }
  caseFilters.includeOrphans = caseFilters.includeOrphans ?? closedCases ?? true;
  const dbResult = await caseDb.search(listConfiguration, accountSid, searchCriteria, caseFilters);
  return {
    ...dbResult,
    cases: dbResult.cases.map(caseRecordToCase),
  };
};

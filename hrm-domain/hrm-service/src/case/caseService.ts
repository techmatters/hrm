/**
 * Copyright (C) 2021-2023 Technology Matters
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see https://www.gnu.org/licenses/.
 */

/**
 * This is the 'business logic' module for Case CRUD operations.
 * For the moment it just does some light mapping between the types used for the REST layer, and the types used for the database layer.
 * This includes compatibility code required to provide cases in a shape expected by older clients
 */
import {
  CaseListConfiguration,
  CaseListFilters,
  CaseRecord,
  CaseRecordCommon,
  CaseSearchCriteria,
  CaseSectionRecord,
  NewCaseRecord,
  SearchQueryFunction,
  create,
  getById,
  search,
  searchByProfileId,
  update,
} from './case-data-access';
import { randomUUID } from 'crypto';
import type { Contact } from '../contact/contact-data-access';
import { setupCanForRules } from '../permissions/setupCanForRules';
import type { TwilioUser } from '@tech-matters/twilio-worker-auth';
import { bindApplyTransformations as bindApplyContactTransformations } from '../contact/contactService';
import type { SearchPermissions } from '../permissions/search-permissions';
import type { Profile } from '../profile/profile-data-access';
import type { PaginationQuery } from '../search';
import { TResult, newErr, newOk } from '@tech-matters/types';

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
  perpetrators: {
    getSectionSpecificData: s => s.perpetrator,
    sectionTypeName: 'perpetrator',
  },
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

export type CaseService = CaseRecordCommon & {
  id: number;
  childName?: string;
  categories: Record<string, string[]>;
  connectedContacts?: Contact[];
};

/**
 * Converts a single list of all sections for a case to a set of arrays grouped by type
 */
const caseSectionRecordsToInfo = (
  sections: CaseSectionRecord[] = [],
): Record<string, CaseInfoSection[]> => {
  const infoLists: Record<string, CaseInfoSection[]> = {};
  return sections.reduce((categorized, record) => {
    const {
      caseId,
      sectionType,
      sectionId,
      sectionTypeSpecificData,
      createdBy,
      ...restOfRecord
    } = record;

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

const addCategories = (caseItem: CaseRecord) => {
  const fstContact = (caseItem.connectedContacts ?? [])[0];

  return { ...caseItem, categories: fstContact?.rawJson?.categories ?? {} };
};

/**
 * Converts a case passed in from the API to a case record ready to write to the DB
 * @param inputCase
 * @param workerSid
 */
const caseToCaseRecord = (
  inputCase: Partial<CaseService>,
  workerSid: string,
): Partial<NewCaseRecord> => {
  const { connectedContacts, ...caseWithoutContacts } = inputCase;
  const info = inputCase.info ?? {};
  const caseSections: CaseSectionRecord[] = Object.entries(
    WELL_KNOWN_CASE_SECTION_NAMES,
  ).flatMap(([sectionName, { getSectionSpecificData, sectionTypeName }]) =>
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
    ...caseWithoutContacts,
    caseSections,
  };
};

const caseRecordToCase = (record: CaseRecord): CaseService => {
  // Remove legacy case sections
  const info = {
    ...record.info,
  };
  Object.keys(WELL_KNOWN_CASE_SECTION_NAMES).forEach(k => delete info[k]);
  delete info.notes;

  const { caseSections, ...output } = addCategories({
    ...record,
    info: {
      ...info,
      ...caseSectionRecordsToInfo(record.caseSections),
    },
  });

  return output;
};

const mapContactTransformations =
  ({ can, user }: { can: ReturnType<typeof setupCanForRules>; user: TwilioUser }) =>
  (caseRecord: CaseRecord) => {
    const applyTransformations = bindApplyContactTransformations(can, user);
    const withTransformedContacts = {
      ...caseRecord,
      ...(caseRecord.connectedContacts && {
        connectedContacts: caseRecord.connectedContacts.map(applyTransformations),
      }),
    };

    return withTransformedContacts;
  };

export const createCase = async (
  body: Partial<CaseService>,
  accountSid: CaseService['accountSid'],
  workerSid: CaseService['twilioWorkerId'],
): Promise<CaseService> => {
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
  const created = await create(record, accountSid);

  // A new case is always initialized with empty connected contacts. No need to apply mapContactTransformations here
  return caseRecordToCase(created);
};

export const updateCase = async (
  id: CaseService['id'],
  body: Partial<CaseService>,
  accountSid: CaseService['accountSid'],
  workerSid: CaseService['twilioWorkerId'],
  { can, user }: { can: ReturnType<typeof setupCanForRules>; user: TwilioUser },
): Promise<CaseService> => {
  const caseFromDB: CaseRecord = await getById(id, accountSid);
  if (!caseFromDB) {
    return;
  }

  const nowISO = new Date().toISOString();

  const record = caseToCaseRecord(
    { ...body, updatedBy: workerSid, updatedAt: nowISO, id, accountSid },
    workerSid,
    // caseRecordToCase(caseFromDB),
  );

  const updated = await update(id, record, accountSid);

  const withTransformedContacts = mapContactTransformations({ can, user })(updated);

  return caseRecordToCase(withTransformedContacts);
};

export const getCase = async (
  id: number,
  accountSid: string,
  { can, user }: { can: ReturnType<typeof setupCanForRules>; user: TwilioUser },
): Promise<CaseService | undefined> => {
  const caseFromDb = await getById(id, accountSid);

  if (caseFromDb) {
    return caseRecordToCase(mapContactTransformations({ can, user })(caseFromDb));
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

export type CaseSearchReturn = {
  cases: CaseService[];
  count: number;
};

/**
 * Check if the user can view any case given:
 * - search permissions
 * - counsellors' filter
 */
const cannotViewAnyCasesGivenTheseCounsellors = (
  user: TwilioUser,
  searchPermissions: SearchPermissions,
  counsellors?: string[],
) =>
  searchPermissions.canOnlyViewOwnCases &&
  counsellors &&
  counsellors.length > 0 &&
  !counsellors.includes(user.workerSid);

/**
 * If the counselors can only view cases he/she owns, then we override caseFilters.counsellors to [workerSid]
 */
const overrideCounsellors = (
  user: TwilioUser,
  searchPermissions: SearchPermissions,
  counsellors?: string[],
) => (searchPermissions.canOnlyViewOwnCases ? [user.workerSid] : counsellors);

const generalizedSearchCases =
  <
    T,
    U extends {
      filters?: CaseListFilters;
      helpline?: string;
      counselor?: string;
      closedCases?: boolean;
    },
  >(
    searchQuery: SearchQueryFunction<T>,
  ) =>
  async (
    accountSid: string,
    listConfiguration: CaseListConfiguration,
    searchParameters: T,
    filterParameters: U,
    {
      can,
      user,
      searchPermissions,
    }: {
      can: ReturnType<typeof setupCanForRules>;
      user: TwilioUser;
      searchPermissions: SearchPermissions;
    },
  ): Promise<CaseSearchReturn> => {
    const { filters, helpline, counselor, closedCases } = filterParameters;
    const caseFilters = filters ?? {};
    caseFilters.helplines =
      caseFilters.helplines ?? (helpline ? helpline.split(';') : undefined);
    caseFilters.counsellors =
      caseFilters.counsellors ?? (counselor ? counselor.split(';') : undefined);
    caseFilters.excludedStatuses = caseFilters.excludedStatuses ?? [];
    if (closedCases === false) {
      caseFilters.excludedStatuses.push('closed');
    }
    caseFilters.includeOrphans = caseFilters.includeOrphans ?? closedCases ?? true;

    /**
     * VIEW_CASE permission:
     * Handle filtering cases according to: https://github.com/techmatters/hrm/pull/316#discussion_r1131118034
     * The search query already filters the cases given an array of counsellors.
     */
    if (
      cannotViewAnyCasesGivenTheseCounsellors(
        user,
        searchPermissions,
        caseFilters.counsellors,
      )
    ) {
      return {
        count: 0,
        cases: [],
      };
    } else {
      caseFilters.counsellors = overrideCounsellors(
        user,
        searchPermissions,
        caseFilters.counsellors,
      );
    }

    const dbResult = await searchQuery(
      listConfiguration,
      accountSid,
      searchParameters,
      caseFilters,
    );
    return {
      ...dbResult,
      cases: dbResult.cases
        .map(mapContactTransformations({ can, user }))
        .map(caseRecordToCase),
    };
  };

export const searchCases = generalizedSearchCases(search);

const searchCasesByProfileId = generalizedSearchCases(searchByProfileId);

export const getCasesByProfileId = async (
  accountSid: string,
  profileId: Profile['id'],
  query: Pick<PaginationQuery, 'limit' | 'offset'>,
  ctx: {
    can: ReturnType<typeof setupCanForRules>;
    user: TwilioUser;
    searchPermissions: SearchPermissions;
  },
): Promise<TResult<Awaited<ReturnType<typeof searchCasesByProfileId>>>> => {
  try {
    const cases = await searchCasesByProfileId(accountSid, query, { profileId }, {}, ctx);

    return newOk({ data: cases });
  } catch (err) {
    return newErr({
      message: err instanceof Error ? err.message : String(err),
    });
  }
};

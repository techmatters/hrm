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
  CaseSearchCriteria,
  SearchQueryFunction,
  create,
  getById,
  search,
  searchByProfileId,
  updateStatus,
  CaseRecordUpdate,
  updateCaseInfo,
} from './caseDataAccess';
import { randomUUID } from 'crypto';
import { InitializedCan } from '../permissions/initializeCanForRules';
import type { TwilioUser } from '@tech-matters/twilio-worker-auth';
import { bindApplyTransformations as bindApplyContactTransformations } from '../contact/contactService';
import type { Profile } from '../profile/profileDataAccess';
import type { PaginationQuery } from '../search';
import { HrmAccountId, TResult, newErr, newOk } from '@tech-matters/types';
import {
  WELL_KNOWN_CASE_SECTION_NAMES,
  CaseService,
  CaseInfoSection,
} from '@tech-matters/types/HrmTypes';
import { RulesFile, TKConditionsSets } from '../permissions/rulesMap';
import { CaseSectionRecord } from './caseSection/types';
import { pick } from 'lodash';

export { WELL_KNOWN_CASE_SECTION_NAMES, CaseService, CaseInfoSection };

const CASE_OVERVIEW_PROPERTIES = ['summary', 'followUpDate', 'childIsAtRisk'] as const;
type CaseOverviewProperties = (typeof CASE_OVERVIEW_PROPERTIES)[number];

type RecursivePartial<T> = {
  [P in keyof T]?: RecursivePartial<T[P]>;
};

type CaseServiceUpdate = Partial<CaseService> & Pick<CaseService, 'updatedBy'>;

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
      sectionId: id,
      sectionTypeSpecificData,
      createdBy,
      eventTimestamp,
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
          id: id,
          twilioWorkerId: createdBy,
        });
        break;
      case 'referral':
        categorized.referrals = categorized.referrals ?? [];
        categorized.referrals.push({
          ...sectionTypeSpecificData,
          ...restOfRecord,
          id: id,
          twilioWorkerId: createdBy,
        });
        break;
      default:
        const listName = `${record.sectionType}s`;
        categorized[listName] = categorized[listName] ?? [];
        categorized[listName].push({
          ...restOfRecord,
          id: id,
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
 * Code to convert sections to section records is deprecated and should be removed in v1.16
 * @param inputCase
 * @param workerSid
 */
const caseToCaseRecord = (
  inputCase: CaseServiceUpdate,
  workerSid: string,
): CaseRecordUpdate => {
  const { connectedContacts, ...caseWithoutContacts } = inputCase;
  const info = inputCase.info ?? {};
  let anySectionsSpecified = false;
  const caseSections: CaseSectionRecord[] = Object.entries(
    WELL_KNOWN_CASE_SECTION_NAMES,
  ).flatMap(([sectionName, { getSectionSpecificData, sectionTypeName }]) => {
    if (!info[sectionName]) {
      return [];
    }
    anySectionsSpecified = true;
    return (info[sectionName] ?? []).map(section => {
      const caseSectionRecordToUpsert: CaseSectionRecord = {
        caseId: inputCase.id,
        sectionType: sectionTypeName,
        sectionId: section.id ?? randomUUID(),
        createdBy: section.twilioWorkerId ?? workerSid,
        createdAt: section.createdAt ?? new Date().toISOString(),
        eventTimestamp:
          section.eventTimestamp ?? section.createdAt ?? new Date().toISOString(),
        updatedBy: section.updatedBy,
        updatedAt: section.updatedAt,
        sectionTypeSpecificData: getSectionSpecificData(section),
        accountSid: section.accountSid,
      };
      return caseSectionRecordToUpsert;
    });
  });
  if (anySectionsSpecified) {
    return {
      ...caseWithoutContacts,
      caseSections,
    };
  }
  return caseWithoutContacts;
};

const caseRecordToCase = (record: CaseRecord): CaseService => {
  // Remove legacy case sections
  const info = {
    ...record.info,
  };
  Object.keys(WELL_KNOWN_CASE_SECTION_NAMES).forEach(k => delete info[k]);

  const { caseSections, contactsOwnedByUserCount, ...output } = addCategories({
    ...record,
    // Deprecated, remove in v1.16
    info: {
      ...info,
      ...caseSectionRecordsToInfo(record.caseSections),
    },
  });
  const precalculatedPermissions = { userOwnsContact: contactsOwnedByUserCount > 0 };

  if (record.caseSections) {
    return {
      ...output,
      // Separate case sections by type
      sections: record.caseSections.reduce(
        (sections, sectionRecord) => {
          const { sectionType, caseId, accountSid, ...restOfSection } = sectionRecord;
          sections[sectionType] = sections[sectionType] ?? [];
          sections[sectionType].push(restOfSection);
          return sections;
        },
        {} as CaseService['sections'],
      ),
      precalculatedPermissions,
    };
  }

  return {
    ...output,
    // Separate case sections by type
    precalculatedPermissions: { userOwnsContact: contactsOwnedByUserCount > 0 },
  } as CaseService;
};

const mapContactTransformations =
  ({ can, user }: { can: InitializedCan; user: TwilioUser }) =>
  (caseRecord: CaseRecord) => {
    const applyTransformations = bindApplyContactTransformations(can, user);
    return {
      ...caseRecord,
      ...(caseRecord.connectedContacts && {
        connectedContacts: caseRecord.connectedContacts.map(applyTransformations),
      }),
    };
  };

/**
 * This function omits the non-essential data from a case record.
 * Only the properties that are essential for the client to display the case are kept.
 *
 * This is used on both:
 * - GET /cases/ (case list)
 * - POST /cases/search (search cases)
 */
const mapEssentialData =
  (essentialDataOnly: boolean) =>
  (caseRecord: CaseService): RecursivePartial<CaseService> => {
    if (!essentialDataOnly) return caseRecord;

    const {
      id,
      createdAt,
      updatedAt,
      status,
      info,
      twilioWorkerId,
      connectedContacts,
      categories,
    } = caseRecord;

    const { summary, followUpDate, definitionVersion } = info;

    const infoEssentialData = {
      summary,
      followUpDate,
      definitionVersion,
    };

    return {
      id,
      status,
      connectedContacts: connectedContacts.slice(0, 1),
      twilioWorkerId,
      categories,
      createdAt,
      updatedAt,
      info: infoEssentialData,
      precalculatedPermissions: caseRecord.precalculatedPermissions,
    };
  };

export const createCase = async (
  body: Partial<CaseService>,
  accountSid: CaseService['accountSid'],
  workerSid: CaseService['twilioWorkerId'],
  testNowISO?: Date,
): Promise<CaseService> => {
  const nowISO = (testNowISO ?? new Date()).toISOString();
  delete body.id;
  const record = caseToCaseRecord(
    {
      twilioWorkerId: workerSid,
      ...body,
      createdBy: workerSid,
      createdAt: nowISO,
      updatedAt: nowISO,
      updatedBy: null,
      accountSid,
    },
    workerSid,
  );
  const created = await create(record);

  // A new case is always initialized with empty connected contacts. No need to apply mapContactTransformations here
  return caseRecordToCase(created);
};

export const updateCaseStatus = async (
  id: CaseService['id'],
  status: string,
  accountSid: CaseService['accountSid'],
  {
    can,
    user,
    permissions,
  }: { can: InitializedCan; user: TwilioUser; permissions: RulesFile },
): Promise<CaseService> => {
  const { workerSid } = user;
  const updated = await updateStatus(
    id,
    status,
    workerSid,
    accountSid,
    user,
    permissions.viewContact as TKConditionsSets<'contact'>,
  );

  const withTransformedContacts = mapContactTransformations({ can, user })(updated);

  return caseRecordToCase(withTransformedContacts);
};

export const updateCaseOverview = async (
  accountSid: CaseService['accountSid'],
  id: CaseService['id'],
  overview: Pick<CaseService['info'], CaseOverviewProperties>,
  workerSid: CaseService['twilioWorkerId'],
): Promise<CaseService> => {
  const validOverview = pick(overview, CASE_OVERVIEW_PROPERTIES);
  const updated = await updateCaseInfo(accountSid, id, validOverview, workerSid);

  return caseRecordToCase(updated);
};

export const getCase = async (
  id: number,
  accountSid: HrmAccountId,
  {
    can,
    user,
    permissions,
  }: {
    can: InitializedCan;
    user: TwilioUser;
    permissions: Pick<RulesFile, 'viewContact'>;
  },
  onlyEssentialData?: boolean,
): Promise<CaseService | undefined> => {
  const caseFromDb = await getById(
    id,
    accountSid,
    user,
    permissions.viewContact as TKConditionsSets<'contact'>,
    onlyEssentialData,
  );

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
  cases: CaseService[] | RecursivePartial<CaseService>[];
  count: number;
};

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
    accountSid: HrmAccountId,
    listConfiguration: CaseListConfiguration,
    searchParameters: T,
    filterParameters: U,
    {
      can,
      user,
      permissions,
    }: {
      can: InitializedCan;
      user: TwilioUser;
      permissions: RulesFile;
    },
    onlyEssentialData?: boolean,
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
    const viewCasePermissions = permissions.viewCase as TKConditionsSets<'case'>;
    const viewContactPermissions = permissions.viewContact as TKConditionsSets<'contact'>;

    const dbResult = await searchQuery(
      user,
      viewCasePermissions,
      viewContactPermissions,
      listConfiguration,
      accountSid,
      searchParameters,
      caseFilters,
      onlyEssentialData,
    );
    return {
      ...dbResult,
      cases: dbResult.cases
        .map(mapContactTransformations({ can, user }))
        .map(caseRecordToCase)
        .map(mapEssentialData(onlyEssentialData)),
    };
  };

export const searchCases = generalizedSearchCases(search);

const searchCasesByProfileId = generalizedSearchCases(searchByProfileId);

export const getCasesByProfileId = async (
  accountSid: HrmAccountId,
  profileId: Profile['id'],
  query: Pick<PaginationQuery, 'limit' | 'offset'>,
  ctx: {
    can: InitializedCan;
    user: TwilioUser;
    permissions: RulesFile;
  },
): Promise<
  TResult<'InternalServerError', Awaited<ReturnType<typeof searchCasesByProfileId>>>
> => {
  try {
    const cases = await searchCasesByProfileId(accountSid, query, { profileId }, {}, ctx);

    return newOk({ data: cases });
  } catch (err) {
    return newErr({
      message: err instanceof Error ? err.message : String(err),
      error: 'InternalServerError',
    });
  }
};

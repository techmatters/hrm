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
  deleteById,
  searchByCaseIds,
} from './caseDataAccess';
import { InitializedCan } from '../permissions/initializeCanForRules';
import type { TwilioUser } from '@tech-matters/twilio-worker-auth';
import { bindApplyTransformations as bindApplyContactTransformations } from '../contact/contactService';
import type { Profile } from '../profile/profileDataAccess';
import type { PaginationQuery } from '../search';
import { HrmAccountId, TResult, newErr, newOk } from '@tech-matters/types';
import { CaseService, CaseInfoSection } from '@tech-matters/hrm-types';
import { RulesFile, TKConditionsSets } from '../permissions/rulesMap';
import { pick } from 'lodash';
import {
  DocumentType,
  HRM_CASES_INDEX_TYPE,
  hrmSearchConfiguration,
} from '@tech-matters/hrm-search-config';
import { publishCaseChangeNotification } from '../notifications/entityChangeNotify';
import { enablePublishHrmSearchIndex } from '../featureFlags';
import { getClient } from '@tech-matters/elasticsearch-client';
import {
  CaseListCondition,
  generateCasePermissionsFilters,
  generateCaseSearchFilters,
} from './caseSearchIndex';
import { ContactListCondition } from '../contact/contactSearchIndex';
import { maxPermissions } from '../permissions';
import { NotificationOperation } from '@tech-matters/hrm-types/NotificationOperation';

export { CaseService, CaseInfoSection };

const CASE_OVERVIEW_PROPERTIES = ['summary', 'followUpDate', 'childIsAtRisk'] as const;
type CaseOverviewProperties = (typeof CASE_OVERVIEW_PROPERTIES)[number];

type RecursivePartial<T> = {
  [P in keyof T]?: RecursivePartial<T[P]>;
};

type CaseServiceUpdate = Partial<CaseService> & Pick<CaseService, 'updatedBy'>;

const addCategories = (caseItem: CaseRecord) => {
  const fstContact = (caseItem.connectedContacts ?? [])[0];

  return { ...caseItem, categories: fstContact?.rawJson?.categories ?? {} };
};

/**
 * Converts a case passed in from the API to a case record ready to write to the DB
 * @param inputCase
 */
const caseToCaseRecord = (inputCase: CaseServiceUpdate): CaseRecordUpdate => {
  const { connectedContacts, ...caseWithoutContacts } = inputCase;
  return caseWithoutContacts;
};

export const caseRecordToCase = (record: CaseRecord): CaseService => {
  const { caseSections, contactsOwnedByUserCount, ...output } = addCategories(record);
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

const doCaseChangeNotification =
  (operation: NotificationOperation) =>
  async ({
    accountSid,
    caseId,
    caseRecord,
  }: {
    accountSid: CaseService['accountSid'];
    caseId: CaseService['id'];
    caseRecord?: CaseRecord;
  }) => {
    try {
      if (!enablePublishHrmSearchIndex) {
        return;
      }

      const caseObj =
        caseRecord || (await getById(caseId, accountSid, maxPermissions.user, []));

      if (caseObj) {
        await publishCaseChangeNotification({
          accountSid,
          case: caseRecordToCase(caseObj),
          operation,
        });
      }
    } catch (err) {
      console.error(
        `Error trying to index case: accountSid ${accountSid} caseId ${caseId}`,
        err,
      );
    }
  };

export const createCaseNotify = doCaseChangeNotification('create');
export const updateCaseNotify = doCaseChangeNotification('update');
const deleteCaseNotify = doCaseChangeNotification('delete');

export const createCase = async (
  body: Partial<CaseService>,
  accountSid: CaseService['accountSid'],
  workerSid: CaseService['twilioWorkerId'],
  testNowISO?: Date,
  skipSearchIndex = false,
): Promise<CaseService> => {
  const nowISO = (testNowISO ?? new Date()).toISOString();
  delete body.id;
  const record = caseToCaseRecord({
    twilioWorkerId: workerSid,
    ...body,
    createdBy: workerSid,
    createdAt: nowISO,
    updatedAt: nowISO,
    updatedBy: null,
    accountSid,
  });
  const created = await create(record);

  if (!skipSearchIndex) {
    // trigger index operation but don't await for it
    createCaseNotify({ accountSid, caseId: created.id });
  }

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
  skipSearchIndex = false,
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

  if (!skipSearchIndex) {
    // trigger index operation but don't await for it
    updateCaseNotify({ accountSid, caseId: updated.id });
  }

  return caseRecordToCase(withTransformedContacts);
};

export const updateCaseOverview = async (
  accountSid: CaseService['accountSid'],
  id: CaseService['id'],
  overview: Pick<CaseService['info'], CaseOverviewProperties>,
  workerSid: CaseService['twilioWorkerId'],
  skipSearchIndex = false,
): Promise<CaseService> => {
  const validOverview = pick(overview, CASE_OVERVIEW_PROPERTIES);
  const updated = await updateCaseInfo(accountSid, id, validOverview, workerSid);

  if (!skipSearchIndex) {
    // trigger index operation but don't await for it
    updateCaseNotify({ accountSid, caseId: updated.id });
  }

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

export const searchCasesByIds = generalizedSearchCases(searchByCaseIds);

export const generalisedCasesSearch = async (
  accountSid: HrmAccountId,
  searchParameters: {
    searchTerm: string;
    counselor?: string;
    dateFrom?: string;
    dateTo?: string;
  },
  query: Pick<PaginationQuery, 'limit' | 'offset'>,
  ctx: {
    can: InitializedCan;
    user: TwilioUser;
    permissions: RulesFile;
  },
): Promise<TResult<'InternalServerError', CaseSearchReturn>> => {
  try {
    const { searchTerm, counselor, dateFrom, dateTo } = searchParameters;
    const { limit, offset } = query;

    const pagination = {
      limit: parseInt((limit as string) || '20', 10),
      start: parseInt((offset as string) || '0', 10),
    };

    const searchFilters = generateCaseSearchFilters({ counselor, dateFrom, dateTo });
    const permissionFilters = generateCasePermissionsFilters({
      user: ctx.user,
      viewContact: ctx.permissions.viewContact as ContactListCondition[][],
      viewTranscript: ctx.permissions.viewExternalTranscript as ContactListCondition[][],
      viewCase: ctx.permissions.viewCase as CaseListCondition[][],
    });

    const client = (
      await getClient({
        accountSid,
        indexType: HRM_CASES_INDEX_TYPE,
        ssmConfigParameter: process.env.SSM_PARAM_ELASTICSEARCH_CONFIG,
      })
    ).searchClient(hrmSearchConfiguration);

    const { total, items } = await client.search({
      searchParameters: {
        type: DocumentType.Case,
        searchTerm,
        searchFilters,
        permissionFilters,
        pagination,
      },
    });

    const caseIds = items.map(item => parseInt(item.id, 10));

    const { cases } = await searchCasesByIds(
      accountSid,
      {}, // limit and offset are computed in ES query
      { caseIds },
      {},
      ctx,
    );

    // Monitors & dashboards use this log statement, review them before updating to ensure they remain aligned.
    console.info(
      `[generalised-search-cases] AccountSid: ${accountSid} - Search Complete. Total count from ES: ${total}, Paginated count from ES: ${caseIds.length}, Paginated count from DB: ${cases.length}.`,
    );

    const order = caseIds.reduce(
      (accum, idVal, idIndex) => ({ ...accum, [idVal]: idIndex }),
      {},
    );
    const sorted = cases.sort((a, b) => order[a.id] - order[b.id]);

    return newOk({ data: { count: total, cases: sorted } });
  } catch (err) {
    return newErr({
      message: err instanceof Error ? err.message : String(err),
      error: 'InternalServerError',
    });
  }
};

export const deleteCaseById = async ({
  accountSid,
  caseId,
}: {
  accountSid: HrmAccountId;
  caseId: number;
}) => {
  const deleted = await deleteById(caseId, accountSid);

  // trigger remove operation but don't await for it
  deleteCaseNotify({ accountSid, caseId: deleted?.id, caseRecord: deleted });

  return deleted;
};

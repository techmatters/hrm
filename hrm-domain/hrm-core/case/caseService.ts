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
  create,
  deleteById,
  getById,
  list,
  searchByCaseIds,
  searchByProfileId,
  SearchQueryFunction,
  updateCaseInfo,
  updateStatus,
} from './caseDataAccess';
import { InitializedCan } from '../permissions/initializeCanForRules';
import type { TwilioUser } from '@tech-matters/twilio-worker-auth';
import type { Profile } from '../profile/profileDataAccess';
import type { PaginationQuery } from '../search';
import { HrmAccountId, newErr, newOk, TResult } from '@tech-matters/types';
import { CaseInfoSection, CaseService, TimelineActivity } from '@tech-matters/hrm-types';
import { RulesFile, TKConditionsSets } from '../permissions/rulesMap';

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
import { getMultipleCaseTimelines } from './caseSection/caseSectionService';

export { CaseService, CaseInfoSection };

const REQUIRED_CASE_OVERVIEW_PROPERTIES = ['summary'] as const;
type RequiredCaseOverviewProperties = (typeof REQUIRED_CASE_OVERVIEW_PROPERTIES)[number];

type RecursivePartial<T> = {
  [P in keyof T]?: RecursivePartial<T[P]>;
};

export const caseRecordToCase = (record: CaseRecord): CaseService => {
  const { contactsOwnedByUserCount, ...output } = record;

  return {
    ...output,
    id: record.id.toString(),
    precalculatedPermissions: { userOwnsContact: contactsOwnedByUserCount > 0 },
  } as CaseService;
};

export const getTimelinesForCases = async (
  accountSid: CaseRecord['accountSid'],
  userData: {
    user: TwilioUser;
    permissions: RulesFile;
  },
  cases: CaseService[],
): Promise<{ case: CaseService; timeline: TimelineActivity<any>[] }[]> => {
  const { timelines } = await getMultipleCaseTimelines(
    accountSid,
    userData,
    cases.map(c => c.id),
    ['*'],
    true,
    { offset: '0', limit: '5000' },
  );
  return cases.map(c => ({
    case: c,
    timeline: timelines[c.id] ?? [],
  }));
};

export const getTimelineForCase = async (
  accountSid: CaseService['accountSid'],
  userData: {
    user: TwilioUser;
    permissions: RulesFile;
  },
  cas: CaseService,
): Promise<TimelineActivity<any>[]> => {
  return (await getTimelinesForCases(accountSid, userData, [cas]))[0].timeline;
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
        caseRecord ?? (await getById(parseInt(caseId), accountSid, maxPermissions.user));

      if (caseObj) {
        const caseService = caseRecordToCase(caseObj);
        const timeline = await getTimelineForCase(
          accountSid,
          maxPermissions,
          caseService,
        );
        await publishCaseChangeNotification({
          accountSid,
          caseObj: caseService,
          timeline,
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
  // TODO: this is compatibility code, remove info.definitionVersion default once all clients use top level definition version
  const definitionVersion = body.definitionVersion || body.info.definitionVersion;

  if (!definitionVersion) {
    throw new Error('createCase error: missing definition version parameter');
  }

  delete body.id;
  const record = {
    twilioWorkerId: workerSid,
    ...body,
    createdBy: workerSid,
    createdAt: nowISO,
    updatedAt: nowISO,
    updatedBy: null,
    accountSid,
    definitionVersion,
  };
  const created = await create(record);

  if (!skipSearchIndex) {
    await createCaseNotify({ accountSid, caseId: created.id.toString() });
  }

  // A new case is always initialized with empty connected contacts. No need to apply mapContactTransformations here
  return caseRecordToCase(created);
};

export const updateCaseStatus = async (
  id: CaseService['id'],
  status: string,
  accountSid: CaseService['accountSid'],
  { user }: { user: TwilioUser },
  skipSearchIndex = false,
): Promise<CaseService> => {
  const { workerSid } = user;
  const updated = await updateStatus(id, status, workerSid, accountSid);

  // Case not found
  if (!updated) return null;

  if (!skipSearchIndex) {
    await updateCaseNotify({ accountSid, caseId: updated.id.toString() });
  }

  return caseRecordToCase(updated);
};

export const updateCaseOverview = async (
  accountSid: CaseService['accountSid'],
  id: CaseService['id'],
  overview: Partial<CaseService['info']> &
    Pick<CaseService['info'], RequiredCaseOverviewProperties>,
  workerSid: CaseService['twilioWorkerId'],
  skipSearchIndex = false,
): Promise<CaseService> => {
  const updated = await updateCaseInfo(accountSid, parseInt(id), overview, workerSid);

  if (!updated) return null;

  if (!skipSearchIndex) {
    await updateCaseNotify({ accountSid, caseId: updated.id });
  }

  return caseRecordToCase(updated);
};

export const getCase = async (
  id: string,
  accountSid: HrmAccountId,
  {
    user,
  }: {
    user: TwilioUser;
  },
): Promise<CaseService | undefined> => {
  const caseFromDb = await getById(parseInt(id), accountSid, user);

  if (caseFromDb) {
    return caseRecordToCase(caseFromDb);
  }
  return;
};

export type SearchParameters = {
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
      user,
      permissions,
    }: {
      can: InitializedCan;
      user: TwilioUser;
      permissions: RulesFile;
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
    const viewCasePermissions = permissions.viewCase as TKConditionsSets<'case'>;

    const dbResult = await searchQuery(
      user,
      viewCasePermissions,
      listConfiguration,
      accountSid,
      searchParameters,
      caseFilters,
    );
    return {
      ...dbResult,
      cases: dbResult.cases.map(r => caseRecordToCase(r)),
    };
  };

export const listCases = generalizedSearchCases(list);

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
  caseId: string;
}) => {
  const deleted = await deleteById(parseInt(caseId), accountSid);

  await deleteCaseNotify({
    accountSid,
    caseId: deleted?.id?.toString(),
    caseRecord: deleted,
  });

  return deleted;
};

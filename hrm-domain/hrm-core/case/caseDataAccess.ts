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

import { getDbForAccount, getDbForAdmin, pgp } from '../dbConnection';
import { getPaginationElements } from '../search';
import { PATCH_CASE_INFO_BY_ID, updateByIdSql } from './sql/caseUpdateSql';
import {
  OrderByColumnType,
  SearchQueryBuilder,
  SELECT_CASES_TO_RENOTIFY,
  selectCaseFilterOnly,
  selectCasesByIds,
  selectCaseSearchByProfileId,
} from './sql/caseSearchSql';
import { DELETE_BY_ID } from './sql/case-delete-sql';
import { selectSingleCaseByIdSql } from './sql/caseGetSql';
import { DateFilter, OrderByDirectionType } from '../sql';
import { TKConditionsSets } from '../permissions/rulesMap';
import { TwilioUser } from '@tech-matters/twilio-worker-auth';
import { AccountSID, TwilioUserIdentifier } from '@tech-matters/types';
import {
  PrecalculatedCasePermissionConditions,
  CaseRecordCommon,
} from '@tech-matters/hrm-types';
import { pick } from 'lodash';
import { HrmAccountId } from '@tech-matters/types';
import QueryStream from 'pg-query-stream';

export { PrecalculatedCasePermissionConditions, CaseRecordCommon };

// Exported for testing
export const VALID_CASE_CREATE_FIELDS: (keyof CaseRecordCommon)[] = [
  'accountSid',
  'info',
  'helpline',
  'status',
  'twilioWorkerId',
  'createdBy',
  'createdAt',
  'label',
  'definitionVersion',
];

export type NewCaseRecord = CaseRecordCommon;

export type CaseRecordUpdate = Partial<NewCaseRecord> & Pick<NewCaseRecord, 'updatedBy'>;

export type CaseRecord = CaseRecordCommon & {
  id: number;
  contactsOwnedByUserCount?: number;
};

type CaseWithCount = CaseRecord & { totalCount: number };

export type ListConfiguration = {
  offset?: string;
  limit?: string;
};

export type CaseListConfiguration = {
  sortBy?: OrderByColumnType;
  sortDirection?: OrderByDirectionType;
} & ListConfiguration;

export type CaseSearchCriteria = {
  phoneNumber?: string;
  contactNumber?: string;
  firstName?: string;
  lastName?: string;
};

export type CaseListFilters = {
  statuses?: string[];
  excludedStatuses?: string[];
  counsellors?: string[];
  caseInfoFilters?: { [key: string]: string[] };
  createdAt?: DateFilter;
  updatedAt?: DateFilter;
  helplines?: string[];
  includeOrphans?: boolean;
};

export const create = async (caseRecord: Partial<NewCaseRecord>): Promise<CaseRecord> => {
  const db = await getDbForAccount(caseRecord.accountSid);
  return db.task(async connection => {
    const statement = `${pgp.helpers.insert(
      {
        ...pick(caseRecord, VALID_CASE_CREATE_FIELDS),
        updatedAt: caseRecord.createdAt,
      },
      null,
      'Cases',
    )} RETURNING *`;
    let inserted: CaseRecord = await connection.one(statement);
    // eslint-disable-next-line @typescript-eslint/dot-notation
    if ((caseRecord['caseSections'] ?? []).length) {
      // No compatibility needed here as flex doesn't create cases with sections
      console.warn(
        `[DEPRECATION WARNING] Support for creating case sections with a case has been removed as of HRM v1.15.0. Add case sections using the dedicated case section CRUD endpoints going forward.`,
      );
    }

    return inserted;
  });
};

export const getById = async (
  caseId: number,
  accountSid: HrmAccountId,
  { workerSid }: TwilioUser,
): Promise<CaseRecord | undefined> => {
  const db = await getDbForAccount(accountSid);
  return db.task(async connection => {
    const statement = selectSingleCaseByIdSql('Cases');
    const queryValues = {
      accountSid,
      caseId,
      twilioWorkerSid: workerSid,
    };
    return connection.oneOrNone<CaseRecord>(statement, queryValues);
  });
};

export type BaseSearchQueryParams = {
  accountSid: HrmAccountId;
  limit: number;
  offset: number;
};
export type OptionalSearchQueryParams = Partial<CaseSearchCriteria & CaseListFilters>;
type SearchQueryParamsBuilder<T> = (
  accountSid: HrmAccountId,
  user: TwilioUser,
  searchCriteria: T,
  filters: CaseListFilters,
  limit: number,
  offset: number,
) => BaseSearchQueryParams & OptionalSearchQueryParams;

export type SearchQueryFunction<T> = (
  user: TwilioUser,
  viewCasePermissions: TKConditionsSets<'case'>,
  listConfiguration: CaseListConfiguration,
  accountSid: HrmAccountId,
  searchCriteria: T,
  filters?: CaseListFilters,
) => Promise<{ cases: CaseRecord[]; count: number }>;

const generalizedSearchQueryFunction = <T>(
  sqlQueryBuilder: SearchQueryBuilder,
  sqlQueryParamsBuilder: SearchQueryParamsBuilder<T>,
): SearchQueryFunction<T> => {
  return async (
    user,
    casePermissions,
    listConfiguration,
    accountSid,
    searchCriteria,
    filters,
  ) => {
    const db = await getDbForAccount(accountSid);
    const { limit, offset, sortBy, sortDirection } =
      getPaginationElements(listConfiguration);
    const orderClause = [{ sortBy, sortDirection }];

    const { count, rows } = await db.task(async connection => {
      const statement = sqlQueryBuilder(user, casePermissions, filters, orderClause);
      const queryValues = sqlQueryParamsBuilder(
        accountSid,
        user,
        searchCriteria,
        filters,
        limit,
        offset,
      );
      const result: CaseWithCount[] = await connection.any<CaseWithCount>(
        statement,
        queryValues,
      );
      const totalCount: number = result.length ? result[0].totalCount : 0;
      return { rows: result, count: totalCount };
    });

    return {
      cases: rows,
      count,
    };
  };
};

export const list: SearchQueryFunction<null> =
  // searchCriteria is only set in legacy search queries. Once support for this is removed, remove this check and all supporting SQL
  generalizedSearchQueryFunction<null>(
    selectCaseFilterOnly,
    (accountSid, user, _criteria, filters, limit, offset) => ({
      ...filters,
      accountSid,
      limit: limit,
      offset: offset,
      twilioWorkerSid: user.workerSid,
    }),
  );

export const searchByProfileId = generalizedSearchQueryFunction<{
  profileId: number;
}>(
  selectCaseSearchByProfileId,
  (accountSid, user, searchParameters, filters, limit, offset) => ({
    accountSid,
    limit,
    offset,
    counsellors: filters.counsellors,
    helpline: filters.helplines,
    profileId: searchParameters.profileId,
    twilioWorkerSid: user.workerSid,
  }),
);

export const deleteById = async (id: CaseRecord['id'], accountSid: AccountSID) => {
  const db = await getDbForAccount(accountSid);
  return db.oneOrNone<CaseRecord>(DELETE_BY_ID, [accountSid, id]);
};

export const updateStatus = async (
  id,
  status: string,
  updatedBy: TwilioUserIdentifier,
  accountSid: HrmAccountId,
): Promise<CaseRecord> => {
  const db = await getDbForAccount(accountSid);
  return db.tx(async transaction => {
    return transaction.oneOrNone(
      updateByIdSql(
        { status, updatedBy, updatedAt: new Date().toISOString() },
        accountSid,
        id,
      ),
    );
  });
};

export const updateCaseInfo = async (
  accountSid: HrmAccountId,
  caseId: CaseRecord['id'],
  infoPatch: CaseRecord['info'],
  updatedBy: string,
) => {
  const db = await getDbForAccount(accountSid);
  return db.tx(async transaction => {
    return transaction.oneOrNone(PATCH_CASE_INFO_BY_ID, {
      infoPatch,
      updatedBy,
      updatedAt: new Date().toISOString(),
      accountSid,
      caseId,
    });
  });
};

export const searchByCaseIds = generalizedSearchQueryFunction<{
  caseIds: CaseRecord['id'][];
}>(selectCasesByIds, (accountSid, user, searchCriteria, filters, limit, offset) => {
  return {
    accountSid,
    limit,
    offset,
    caseIds: searchCriteria.caseIds,
    twilioWorkerSid: user.workerSid,
  };
});

export const streamCasesForRenotifying = async ({
  accountSid,
  filters: { from: dateFrom, to: dateTo },
  batchSize = 1000,
}: {
  accountSid: HrmAccountId;
  filters: { from: string; to: string };
  batchSize?: number;
}): Promise<NodeJS.ReadableStream> => {
  const qs = new QueryStream(
    pgp.as.format(SELECT_CASES_TO_RENOTIFY, {
      accountSid,
      dateFrom,
      dateTo,
    }),
    [],
    {
      batchSize,
    },
  );

  const db = await Promise.resolve(getDbForAdmin());
  // Expose the readable stream to the caller as a promise for further pipelining
  return new Promise(resolve => {
    db.stream(qs, resultStream => {
      resolve(resultStream);
    });
  });
};

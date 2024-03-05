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

import { db, pgp } from '../connection-pool';
import { getPaginationElements } from '../search';
import { PATCH_CASE_INFO_BY_ID, updateByIdSql } from './sql/caseUpdateSql';
import {
  OrderByColumnType,
  SearchQueryBuilder,
  selectCaseSearch,
  selectCaseSearchByProfileId,
} from './sql/caseSearchSql';
import {
  caseSectionUpsertSql,
  deleteMissingCaseSectionsSql,
} from './sql/case-sections-sql';
import { DELETE_BY_ID } from './sql/case-delete-sql';
import { selectSingleCaseByIdSql } from './sql/caseGetSql';
import { Contact } from '../contact/contactDataAccess';
import { OrderByDirectionType } from '../sql';
import { TKConditionsSets } from '../permissions/rulesMap';
import { TwilioUser } from '@tech-matters/twilio-worker-auth';
import { AccountSID } from '@tech-matters/types';
import { CaseSectionRecord } from './caseSection/types';
import { pick } from 'lodash';

export type PrecalculatedCasePermissionConditions = {
  isCaseContactOwner: boolean; // Does the requesting user own any of the contacts currently connected to the case?
};

export type CaseRecordCommon = {
  info: any;
  helpline: string;
  status: string;
  twilioWorkerId: string;
  createdBy: string;
  updatedBy: string;
  accountSid: AccountSID;
  createdAt: string;
  updatedAt: string;
  statusUpdatedAt?: string;
  statusUpdatedBy?: string;
  previousStatus?: string;
};

// Exported for testing
export const VALID_CASE_CREATE_FIELDS: (keyof CaseRecordCommon)[] = [
  'accountSid',
  'info',
  'helpline',
  'status',
  'twilioWorkerId',
  'createdBy',
  'createdAt',
];

export type NewCaseRecord = CaseRecordCommon;

export type CaseRecordUpdate = Partial<NewCaseRecord> &
  Pick<NewCaseRecord, 'updatedBy'> & {
    caseSections?: CaseSectionRecord[];
  };

export type CaseRecord = CaseRecordCommon & {
  id: number;
  connectedContacts?: Contact[];
  contactsOwnedByUserCount?: number;
  caseSections?: CaseSectionRecord[];
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

export const enum DateExistsCondition {
  MUST_EXIST = 'MUST_EXIST',
  MUST_NOT_EXIST = 'MUST_NOT_EXIST',
}

export type DateFilter = {
  from?: string;
  to?: string;
  exists?: DateExistsCondition;
};

export type CategoryFilter = {
  category: string;
  subcategory: string;
};

export type CaseListFilters = {
  counsellors?: string[];
  statuses?: string[];
  excludedStatuses?: string[];
  createdAt?: DateFilter;
  updatedAt?: DateFilter;
  followUpDate?: DateFilter;
  categories?: CategoryFilter[];
  helplines?: string[];
  includeOrphans?: boolean;
};

export const create = async (caseRecord: Partial<NewCaseRecord>): Promise<CaseRecord> => {
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
  accountSid: string,
  { workerSid, isSupervisor }: TwilioUser,
  contactViewPermissions: TKConditionsSets<'contact'>,
  onlyEssentialData?: boolean,
): Promise<CaseRecord | undefined> => {
  return db.task(async connection => {
    const statement = selectSingleCaseByIdSql(
      'Cases',
      contactViewPermissions,
      isSupervisor,
      onlyEssentialData,
    );
    const queryValues = { accountSid, caseId, twilioWorkerSid: workerSid };
    return connection.oneOrNone<CaseRecord>(statement, queryValues);
  });
};

export type BaseSearchQueryParams = {
  accountSid: string;
  limit: number;
  offset: number;
};
export type OptionalSearchQueryParams = Partial<CaseSearchCriteria & CaseListFilters>;
type SearchQueryParamsBuilder<T> = (
  accountSid: string,
  user: TwilioUser,
  searchCriteria: T,
  filters: CaseListFilters,
  limit: number,
  offset: number,
) => BaseSearchQueryParams & OptionalSearchQueryParams;

export type SearchQueryFunction<T> = (
  user: TwilioUser,
  viewCasePermissions: TKConditionsSets<'case'>,
  viewContactPermissions: TKConditionsSets<'contact'>,
  listConfiguration: CaseListConfiguration,
  accountSid: string,
  searchCriteria: T,
  filters?: CaseListFilters,
  onlyEssentialData?: boolean,
) => Promise<{ cases: CaseRecord[]; count: number }>;

const generalizedSearchQueryFunction = <T>(
  sqlQueryBuilder: SearchQueryBuilder,
  sqlQueryParamsBuilder: SearchQueryParamsBuilder<T>,
): SearchQueryFunction<T> => {
  return async (
    user,
    casePermissions,
    contactPermissions,
    listConfiguration,
    accountSid,
    searchCriteria,
    filters,
    onlyEssentialData,
  ) => {
    const { limit, offset, sortBy, sortDirection } =
      getPaginationElements(listConfiguration);
    const orderClause = [{ sortBy, sortDirection }];

    const { count, rows } = await db.task(async connection => {
      const statement = sqlQueryBuilder(
        user,
        casePermissions,
        contactPermissions,
        filters,
        orderClause,
        onlyEssentialData,
      );
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

    return { cases: rows, count };
  };
};

export const search = generalizedSearchQueryFunction<CaseSearchCriteria>(
  selectCaseSearch,
  (accountSid, user, searchCriteria, filters, limit, offset) => ({
    ...filters,
    accountSid,
    firstName: searchCriteria.firstName ? `%${searchCriteria.firstName}%` : null,
    lastName: searchCriteria.lastName ? `%${searchCriteria.lastName}%` : null,
    phoneNumber: searchCriteria.phoneNumber
      ? `%${searchCriteria.phoneNumber.replace(/[\D]/gi, '')}%`
      : null,
    contactNumber: searchCriteria.contactNumber || null,
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

export const deleteById = async (id, accountSid) => {
  return db.oneOrNone(DELETE_BY_ID, [accountSid, id]);
};

export const update = async (
  id,
  caseRecordUpdates: Partial<NewCaseRecord> & { caseSections?: CaseSectionRecord[] },
  accountSid: string,
  { workerSid, isSupervisor }: TwilioUser,
  contactViewPermissions: TKConditionsSets<'contact'>,
): Promise<CaseRecord> => {
  return db.tx(async transaction => {
    const statementValues = {
      accountSid,
      twilioWorkerSid: workerSid,
      caseId: id,
    };
    if (caseRecordUpdates.caseSections) {
      console.info(
        `[DEPRECATION WARNING] Support for updating case sections as part of a case update will be removed as of HRM v1.16.0. Update case sections using the dedicated case section CRUD endpoints going forward.`,
      );
      const allSections: CaseSectionRecord[] = caseRecordUpdates.caseSections ?? [];
      if (allSections.length) {
        await transaction.none(
          caseSectionUpsertSql(allSections.map(s => ({ ...s, accountSid }))),
        );
      }
      // Map case sections into a list of ids grouped by category, which allows a more concise DELETE SQL statement to be generated
      const caseSectionIdsByType = allSections.reduce(
        (idsBySectionType, caseSection) => {
          idsBySectionType[caseSection.sectionType] =
            idsBySectionType[caseSection.sectionType] ?? [];
          idsBySectionType[caseSection.sectionType].push(caseSection.sectionId);
          return idsBySectionType;
        },
        <Record<string, string[]>>{},
      );
      const { sql, values } = deleteMissingCaseSectionsSql(caseSectionIdsByType);
      Object.assign(statementValues, values);
      await transaction.none(sql, statementValues);
    }
    await transaction.none(updateByIdSql(caseRecordUpdates, accountSid, id));

    return transaction.oneOrNone(
      selectSingleCaseByIdSql('Cases', contactViewPermissions, isSupervisor),
      statementValues,
    );
  });
};

export const updateStatus = async (
  id,
  status: string,
  updatedBy: string,
  accountSid: string,
  { isSupervisor }: TwilioUser,
  contactViewPermissions: TKConditionsSets<'contact'>,
) => {
  const statementValues = {
    accountSid,
    twilioWorkerSid: updatedBy,
    caseId: id,
  };
  return db.tx(async transaction => {
    await transaction.none(
      updateByIdSql(
        { status, updatedBy, updatedAt: new Date().toISOString() },
        accountSid,
        id,
      ),
    );
    return transaction.oneOrNone(
      selectSingleCaseByIdSql('Cases', contactViewPermissions, isSupervisor),
      statementValues,
    );
  });
};

export const updateCaseInfo = async (
  accountSid: string,
  caseId: CaseRecord['id'],
  infoPatch: CaseRecord['info'],
  updatedBy: string,
) => {
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

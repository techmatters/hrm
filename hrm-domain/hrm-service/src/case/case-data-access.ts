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
import { updateByIdSql } from './sql/case-update-sql';
import { OrderByColumnType, OrderByDirectionType, selectCaseSearch } from './sql/case-search-sql';
import { caseSectionUpsertSql, deleteMissingCaseSectionsSql } from './sql/case-sections-sql';
import { DELETE_BY_ID } from './sql/case-delete-sql';
import { selectSingleCaseByIdSql } from './sql/case-get-sql';
import { Contact } from '../contact/contact-data-access';
import { parameterizedQuery } from '../parameterizedQuery';

export type CaseRecordCommon = {
  info: any;
  helpline: string;
  status: string;
  twilioWorkerId: string;
  createdBy: string;
  updatedBy: string;
  accountSid: string;
  createdAt: string;
  updatedAt: string;
};

export type NewCaseRecord = CaseRecordCommon & {
  caseSections?: CaseSectionRecord[];
};

export type CaseRecord = CaseRecordCommon & {
  id: number;
  connectedContacts?: Contact[];
  caseSections?: CaseSectionRecord[];
};

type CaseWithCount = CaseRecord & { totalCount: number };

export type CaseSectionRecord = {
  caseId?: number;
  sectionType: string;
  sectionId: string;
  sectionTypeSpecificData: Record<string, any>;
  accountSid: string;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  updatedBy?: string;
};

export type CaseListConfiguration = {
  sortBy?: OrderByColumnType;
  sortDirection?: OrderByDirectionType;
  offset?: string;
  limit?: string;
};

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

export const create = async (
  body: Partial<NewCaseRecord>,
  accountSid: string,
): Promise<CaseRecord> => {
  const { caseSections, ...caseRecord } = body;
  caseRecord.accountSid = accountSid;

  return db.task(async connection => {
    return connection.tx(async transaction => {
      const statement = `${pgp.helpers.insert(caseRecord, null, 'Cases')} RETURNING *`;
      let inserted: CaseRecord = await transaction.one(statement);
      if ((caseSections ?? []).length) {
        const allSections = caseSections.map(s => ({ ...s, caseId: inserted.id, accountSid }));
        const sectionStatement = `${caseSectionUpsertSql(allSections)};${selectSingleCaseByIdSql(
          'Cases',
        )}`;
        const queryValues = { accountSid, caseId: inserted.id };
        inserted = await transaction.one(sectionStatement, queryValues);
      }

      return inserted;
    });
  });
};

export const getById = async (
  caseId: number,
  accountSid: string,
): Promise<CaseRecord | undefined> => {
  return db.task(async connection => {
    const statement = selectSingleCaseByIdSql('Cases');
    const queryValues = { accountSid, caseId };
    return connection.oneOrNone<CaseRecord>(statement, queryValues);
  });
};

export const search = async (
  listConfiguration: CaseListConfiguration,
  accountSid: string,
  searchCriteria: CaseSearchCriteria = {},
  filters: CaseListFilters = {},
): Promise<{ cases: readonly CaseRecord[]; count: number }> => {
  const { limit, offset, sortBy, sortDirection } = getPaginationElements(listConfiguration);
  const orderClause = [{ sortBy, sortDirection }];
  const { count, rows } = await db.task(async connection => {
    const statement = selectCaseSearch(filters, orderClause);
    const queryValues = {
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
    };
    const result: CaseWithCount[] = await connection.manyOrNone<CaseWithCount>(
      parameterizedQuery(statement, queryValues),
    );
    const totalCount: number = result.length ? result[0].totalCount : 0;
    return { rows: result, count: totalCount };
  });

  return { cases: rows, count };
};

export const deleteById = async (id, accountSid) => {
  return db.oneOrNone(DELETE_BY_ID, [accountSid, id]);
};

export const update = async (
  id,
  caseRecordUpdates: Partial<NewCaseRecord>,
  accountSid: string,
): Promise<CaseRecord> => {
  const result = await db.tx(async transaction => {
    const caseUpdateSqlStatements = [selectSingleCaseByIdSql('Cases')];
    const statementValues = {
      accountSid,
      caseId: id,
    };
    if (caseRecordUpdates.info) {
      const allSections: CaseSectionRecord[] = caseRecordUpdates.caseSections ?? [];
      if (allSections.length) {
        caseUpdateSqlStatements.push(
          caseSectionUpsertSql(allSections.map(s => ({ ...s, accountSid }))),
        );
      }
      // Map case sections into a list of ids grouped by category, which allows a more concise DELETE SQL statement to be generated
      const caseSectionIdsByType = allSections.reduce((idsBySectionType, caseSection) => {
        idsBySectionType[caseSection.sectionType] = idsBySectionType[caseSection.sectionType] ?? [];
        idsBySectionType[caseSection.sectionType].push(caseSection.sectionId);
        return idsBySectionType;
      }, <Record<string, string[]>>{});
      const { sql, values } = deleteMissingCaseSectionsSql(caseSectionIdsByType);
      Object.assign(statementValues, values);
      caseUpdateSqlStatements.push(sql);
    }
    caseUpdateSqlStatements.push(updateByIdSql(caseRecordUpdates));
    caseUpdateSqlStatements.push(selectSingleCaseByIdSql('Cases'));

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const output = await transaction.multi<CaseRecord>(
      caseUpdateSqlStatements.join(`;
    `),
      statementValues,
    );
    return output.pop();
  });
  return result.length ? result[0] : void 0;
};

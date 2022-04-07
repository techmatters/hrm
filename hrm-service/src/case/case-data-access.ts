// eslint-disable-next-line prettier/prettier
import type { Case } from './case';
import { db, pgp } from '../connection-pool';
import { getPaginationElements } from '../controllers/helpers';
import pgPromise from 'pg-promise';
import {
  updateByIdSql,
} from './sql/case-update-sql';
import {
  OrderByDirection, selectCaseSearch,
  selectCaseList, OrderByColumns,
} from './sql/case-search-sql';
import { caseSectionUpsertSql, deleteMissingCaseSectionsSql } from './sql/case-sections-sql';
import { DELETE_BY_ID } from './sql/case-delete-sql';
import { selectSingleCaseByIdSql } from './sql/case-get-sql';
/**
 * Move me to contacts directory when that exists
 */
type ContactRecord = {
  id: number;
  rawJson?: any;
  queueName?: string;
  twilioWorkerId?: string;
  createdBy?: string;
  helpline?: string;
  number?: string;
  channel?: string;
  conversationDuration?: number;
  accountSid: string;
  timeOfContact?: Date;
  taskId?: string;
  channelSid?: string;
  serviceSid?: string;
};

export type Contact = ContactRecord & {
  csamReports: any[];
};

export type CaseRecordCommon = {
  info: any;
  helpline: string;
  status: string;
  twilioWorkerId: string;
  createdBy: string;
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

type CaseAuditRecord = {
  previousValue?: any;
  newValue?: any;
  twilioWorkerId: string;
  createdBy: string;
  accountSid: string;
  createdAt: string;
  updatedAt: string;
  caseId: number;
};

export type CaseSectionRecord = {
  caseId?: number;
  sectionType: string;
  sectionId: string;
  sectionTypeSpecificData: Record<string, any>;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  updatedBy?: string;
};

export type CaseListConfiguration = {
  sortBy?: OrderByColumns,
  sortDirection?: OrderByDirection
  offset?: number,
  limit?: number
};

export type CaseSearchCriteria = {
  phoneNumber?: string,
  contactNumber?: string,
  firstName?: string,
  lastName?: string,
};

export type DateFilter = {
  from?: string,
  to?: string,
};

export type CaseListFilters = {
  counsellors?: string[],
  statuses?: string[],
  excludedStatuses?: string[],
  createdAt?: DateFilter,
  helplines?: string[],
  includeOrphans?: boolean
};

const logCaseAudit = async (
  transaction: pgPromise.ITask<unknown>,
  updated: Case,
  original?: Case,
) => {
  const auditRecord: CaseAuditRecord = {
    caseId: updated.id,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
    createdBy: updated.createdBy,
    accountSid: updated.accountSid,
    twilioWorkerId: updated.twilioWorkerId,
    newValue: {
      ...updated,
      contacts: ((<CaseRecord>updated).connectedContacts ?? []).map(cc => cc.id),
    },
    previousValue: original
      ? { ...original, contacts: (original.connectedContacts ?? []).map(cc => cc.id) }
      : null,
  };

  const statement = pgp.helpers.insert(auditRecord, null, 'CaseAudits');
  await transaction.none(statement);
};

export const create = async (
  body: Partial<NewCaseRecord>,
  accountSid,
  toAuditRecord = c => c,
): Promise<CaseRecord> => {
  const { caseSections, ...caseRecord  } = body;
  caseRecord.accountSid = accountSid;

  return db.task(async connection => {
    return connection.tx(async transaction => {
      const statement = `${pgp.helpers.insert(caseRecord, null, 'Cases')} RETURNING *`;
      let inserted: CaseRecord = await transaction.one(statement);
      if ((caseSections ?? []).length) {
        const allSections = caseSections.map(s => ({ ...s, caseId: inserted.id }));
        const sectionStatement = `${caseSectionUpsertSql(allSections)};${selectSingleCaseByIdSql(
          'Cases',
        )}`;
        const queryValues = { accountSid, caseId: inserted.id };
        inserted = await transaction.one(sectionStatement, queryValues);
      }
      await logCaseAudit(transaction, toAuditRecord(inserted));
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
  accountSid,
  searchCriteria: CaseSearchCriteria = {},
  filters: CaseListFilters = {},
): Promise<{ cases: readonly CaseRecord[]; count: number }> => {
  const { limit, offset, sortBy, sortDirection } = getPaginationElements(
    listConfiguration,
  );
  const orderClause = [{ sortBy, sortDirection }];
  const { count, rows } = await db.task(async connection => {
    const statement = selectCaseSearch(filters, orderClause);
    const queryValues = {
      accountSid,
      firstName: searchCriteria.firstName ? `%${searchCriteria.firstName}%` : null,
      lastName: searchCriteria.lastName ? `%${searchCriteria.lastName}%` : null,
      phoneNumber: searchCriteria.phoneNumber ? `%${searchCriteria.phoneNumber.replace(/[\D]/gi, '')}%` : null,
      contactNumber: searchCriteria.contactNumber || null,
      limit: limit,
      offset: offset,
    };
    const result: CaseWithCount[] = await connection.any<CaseWithCount>(statement, queryValues);
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
  accountSid,
  toAuditRecord = c => c,
): Promise<CaseRecord> => {
  const result = await db.tx(async transaction => {
    const caseUpdateSqlStatements = [selectSingleCaseByIdSql('Cases')];
    if (caseRecordUpdates.info) {
      const allSections: CaseSectionRecord[] = caseRecordUpdates.caseSections ?? [];
      if (allSections.length) {
        caseUpdateSqlStatements.push(caseSectionUpsertSql(allSections));
      }
      // Map case sections into a list of ids grouped by category, which allows a more concise DELETE SQL statement to be generated
      const caseSectionIdsByType = allSections.reduce((idsBySectionType, caseSection) => {
        idsBySectionType[caseSection.sectionType] = idsBySectionType[caseSection.sectionType] ?? [];
        idsBySectionType[caseSection.sectionType].push(caseSection.sectionId);
        return idsBySectionType;
      }, <Record<string, string[]>>{});
      caseUpdateSqlStatements.push(deleteMissingCaseSectionsSql(caseSectionIdsByType));
    }
    caseUpdateSqlStatements.push(updateByIdSql(caseRecordUpdates));
    caseUpdateSqlStatements.push(selectSingleCaseByIdSql('Cases'));

    const [original, ...restOfOutput] = await transaction.multi<CaseRecord>(
      caseUpdateSqlStatements.join(`;
    `),
      {
        accountSid,
        caseId: id,
      },
    );
    const updated = restOfOutput.pop();
    if (updated.length) {
      const auditUpdated = toAuditRecord(updated[0]);
      const auditOriginal = toAuditRecord(original[0]);
      await logCaseAudit(transaction, auditUpdated, auditOriginal);
    }
    return updated;
  });
  return result.length ? result[0] : void 0;
};

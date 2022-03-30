import { db, pgp } from '../connection-pool';
import { getPaginationElements } from '../controllers/helpers';
import pgPromise from 'pg-promise';
import {
  DELETE_BY_ID,
  OrderByDirection,
  SELECT_CASE_SEARCH,
  selectCaseList,
  selectSingleCaseByIdSql,
  updateByIdSql,
} from './case-sql';
import { caseSectionUpsertSql, deleteMissingCaseSectionsSql } from './case-sections-sql';
import { randomUUID } from 'crypto';

const CASE_SECTION_NAMES: Record<string, { getSectionSpecificData: (section: any) => any }> = {
  households: { getSectionSpecificData: s => s.household },
  perpetrators: { getSectionSpecificData: s => s.perpetrator },
  incidents: { getSectionSpecificData: s => s.incident },
  counsellorNotes: { getSectionSpecificData: s => ({ note: s.note }) },
  referrals: {
    getSectionSpecificData: s => {
      return { date: s.date, referredTo: s.referredTo, comments: s.comments };
    },
  },
  documents: { getSectionSpecificData: s => s.document },
};

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

export type NewCaseRecord = {
  info: any;
  helpline: string;
  status: string;
  twilioWorkerId: string;
  createdBy: string;
  accountSid: string;
  createdAt: string;
  updatedAt: string;
};

export type CaseRecord = NewCaseRecord & {
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
  caseId: number;
  sectionType: string;
  sectionId: string;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  updatedBy?: string;
  sectionTypeSpecificData: Record<string, any>;
};

const logCaseAudit = async (
  transaction: pgPromise.ITask<unknown>,
  updated: CaseRecord,
  original?: CaseRecord,
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

export const create = async (body, accountSid, workerSid): Promise<CaseRecord> => {
  const now = new Date();
  const caseRecord: NewCaseRecord = {
    info: body.info,
    helpline: body.helpline,
    status: body.status || 'open',
    twilioWorkerId: workerSid,
    createdBy: workerSid,
    accountSid: accountSid,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  return db.task(async connection => {
    return connection.tx(async transaction => {
      const statement = `${pgp.helpers.insert(caseRecord, null, 'Cases')} RETURNING *`;
      const inserted: CaseRecord = await transaction.one(statement);
      await logCaseAudit(transaction, inserted);
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

export const list = async (
  query: { helpline: string },
  accountSid,
): Promise<{ cases: readonly CaseRecord[]; count: number }> => {
  const { limit, offset, sortBy, order = OrderByDirection.ascending } = getPaginationElements(
    query,
  );
  const { helpline } = query;
  const orderClause = [{ sortField: sortBy, sortDirection: <OrderByDirection>order }];
  const { count, rows } = await db.task(async connection => {
    const statement = selectCaseList(orderClause);
    const queryValues = { accountSid, helpline: helpline || null, limit, offset };
    const result: CaseWithCount[] = await connection.any<CaseWithCount>(statement, queryValues);
    const totalCount = result.length ? result[0].totalCount : 0;
    return { rows: result, count: totalCount };
  });

  return { cases: rows, count };
};

export const search = async (
  body,
  query: { helpline: string },
  accountSid,
): Promise<{ cases: readonly CaseRecord[]; count: number }> => {
  const { limit, offset } = getPaginationElements(query);

  const { count, rows } = await db.task(async connection => {
    const statement = SELECT_CASE_SEARCH;
    const queryValues = {
      accountSid,
      helpline: body.helpline || null,
      firstName: body.firstName ? `%${body.firstName}%` : null,
      lastName: body.lastName ? `%${body.lastName}%` : null,
      dateFrom: body.dateFrom || null,
      dateTo: body.dateTo || null,
      phoneNumber: body.phoneNumber ? `%${body.phoneNumber.replace(/[\D]/gi, '')}%` : null,
      counselor: body.counselor || null,
      contactNumber: body.contactNumber || null,
      closedCases: typeof body.closedCases === 'undefined' || body.closedCases,
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
  body: Partial<CaseRecord>,
  accountSid,
  workerSid,
): Promise<CaseRecord> => {
  delete body.accountSid;
  const result = await db.tx(async transaction => {
    const nowISOString = new Date().toISOString();
    const caseRecordUpdates: Partial<NewCaseRecord> = {
      ...body,
      twilioWorkerId: workerSid,
      updatedAt: nowISOString,
    };
    let caseUpdateSql = updateByIdSql(caseRecordUpdates);
    if (caseRecordUpdates.info) {
      // Map individual lists inside the info JSON blob to a list of records for the CaseSections table
      const allSections: CaseSectionRecord[] = Object.entries(CASE_SECTION_NAMES).flatMap(
        ([sectionName, { getSectionSpecificData }]) =>
          (caseRecordUpdates.info[sectionName] ?? []).map(section => {
            const caseSectionRecordToUpsert: CaseSectionRecord = {
              caseId: id,
              sectionType: sectionName,
              sectionId: section.id ?? randomUUID(),
              createdBy: workerSid,
              createdAt: nowISOString,
              sectionTypeSpecificData: getSectionSpecificData(section),
            };
            if (section.id) {
              caseSectionRecordToUpsert.sectionId = section.id;
            }
            return caseSectionRecordToUpsert;
          }),
      );
      if (allSections.length) {
        caseUpdateSql += `;
          ${caseSectionUpsertSql(allSections)}`;
      }
      caseUpdateSql += `;
      ${deleteMissingCaseSectionsSql(
        Object.fromEntries(
          Object.keys(CASE_SECTION_NAMES).map(sectionName => [
            sectionName,
            (caseRecordUpdates.info[sectionName] ?? []).map(s => s.id).filter(deleteId => deleteId),
          ]),
        ),
      )}`;
      console.log('CASE UPDATE SQL WITH CASE SECTION UPDATES:');
      console.log(caseUpdateSql);
    }
    const [original, updated] = await transaction.multi<CaseRecord>(caseUpdateSql, {
      accountSid,
      caseId: id,
    });

    if (updated.length) {
      await logCaseAudit(transaction, updated[0], original[0]);
    }
    return updated;
  });
  return result.length ? result[0] : void 0;
};

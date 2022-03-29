import { db, pgp } from '../connection-pool';
import { getPaginationElements } from '../controllers/helpers';
import pgPromise from 'pg-promise';
import {
  DELETE_BY_ID,
  OrderByDirection,
  SELECT_CASE_AUDITS_FOR_CASE,
  SELECT_CASE_SEARCH,
  selectCaseList,
  selectSingleCaseByIdSql,
  updateByIdSql,
} from './case-sql';

/**
 * Move me to contacts directory when that exists
 */
class ContactRecord {
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
}

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
    const caseRecordUpdates: Partial<NewCaseRecord> = {
      ...body,
      twilioWorkerId: workerSid,
      updatedAt: new Date().toISOString(),
    };

    const updateById = updateByIdSql(caseRecordUpdates);
    const [original, updated] = await transaction.multi<CaseRecord>(updateById, {
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

export const getAuditsForCase = async (accountSid, caseId): Promise<CaseAuditRecord[]> => {
  return db.any<CaseAuditRecord>(SELECT_CASE_AUDITS_FOR_CASE, { accountSid, caseId });
};

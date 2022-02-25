import { db, pgp } from './connection-pool';
import { getPaginationElements, retrieveCategories } from '../controllers/helpers';
import { Contact } from './contact';
import pgPromise from 'pg-promise';
import {
  DELETE_BY_ID,
  SELECT_CASE_AUDITS_FOR_CASE,
  SELECT_CASE_LIST,
  SELECT_CASE_SEARCH,
  updateByIdSql,
} from './case-sql';

type NewCaseRecord = {
  info: any,
  helpline: string,
  status: string,
  twilioWorkerId: string,
  createdBy: string,
  accountSid: string,
  createdAt: string,
  updatedAt: string,
}

export class CaseRecord {
  info: string | null = null;
  id: number;
  helpline: string;
  status: string;
  twilioWorkerId: string;
  createdBy: string;
  accountSid: string;
  createdAt: string;
  updatedAt: string;
}

export type Case = CaseRecord & {
  connectedContacts?: Contact[]
  childName?: string
  categories: Record<string, string[]>
}
type CaseWithCount = Case & {totalCount: number}

type CaseAuditRecord = {
  previousValue?: any,
  newValue?: any,
  twilioWorkerId: string,
  createdBy: string,
  accountSid: string,
  createdAt: string,
  updatedAt: string,
  caseId: number
}

const logCaseAudit = async (transaction: pgPromise.ITask<unknown>, updated: Case | CaseRecord, original?: Case) => {
  const auditRecord: CaseAuditRecord = {
    caseId: updated.id,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
    createdBy: updated.createdBy,
    accountSid: updated.accountSid,
    twilioWorkerId: updated.twilioWorkerId,
    newValue: { ...updated, contacts: ((<Case>updated).connectedContacts ?? []).map(cc => cc.id)},
    previousValue: original ? { ...original, contacts: (original.connectedContacts ?? []).map(cc => cc.id)} : null
  }

  const statement = pgp.helpers.insert(auditRecord, null, "CaseAudits");
  await transaction.none(statement);

}

export const create = async (body, accountSid, workerSid) : Promise<CaseRecord> => {
  const now = new Date();
  const caseRecord: NewCaseRecord = {
    info: body.info,
    helpline: body.helpline,
    status: body.status || 'open',
    twilioWorkerId: workerSid,
    createdBy: workerSid,
    accountSid: accountSid,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };
  return await db.task(
    async connection => {
      return connection.tx(async transaction => {
        const statement = `${pgp.helpers.insert(caseRecord, null, "Cases")} RETURNING *`
        const inserted: CaseRecord = await transaction.one(statement);
        await logCaseAudit(transaction, inserted)
        return inserted;
      })
  });
};

const addCategoriesAndChildName = (caseItem: Case): Case => {
    const fstContact = caseItem.connectedContacts[0];

    if (!fstContact) {
      return {
        ...caseItem,
        childName: '',
        categories: retrieveCategories(undefined), // we call the function here so the return value always matches
      };
    }

    const { childInformation, caseInformation } = fstContact.rawJson;
    const childName = `${childInformation.name.firstName} ${childInformation.name.lastName}`;
    const categories = retrieveCategories(caseInformation.categories);
    return { ...caseItem, childName, categories };
}

export const list = async (query: { helpline: string}, accountSid): Promise<{ cases: readonly Case[], count: number}> => {
  const { limit, offset } = getPaginationElements(query);
  const { helpline } = query;

  const { count, rows } =  await db.task(
    async connection => {
        const statement = SELECT_CASE_LIST
        const queryValues =  {accountSid, helpline: helpline || null, limit, offset}
        const result: CaseWithCount[] = await connection.any<CaseWithCount>(statement, queryValues);
        const count = result.length ? result[0].totalCount : 0;
        return { rows: result, count }
    });

  const cases = rows.map(addCategoriesAndChildName);

  return { cases, count };
};

export const search = async (body, query: { helpline: string}, accountSid): Promise<{ cases: readonly Case[], count: number}> => {
  const { limit, offset } = getPaginationElements(query);

  const { count, rows } =  await db.task(
    async connection => {
      const statement = SELECT_CASE_SEARCH
      const queryValues =  {
        accountSid,
        helpline: body.helpline || null,
        firstName: body.firstName ? `%${body.firstName}%` : null,
        lastName: body.lastName ? `%${body.lastName}%` : null,
        dateFrom: body.dateFrom || null,
        dateTo: body.dateTo || null,
        phoneNumber: body.phoneNumber ? `%${body.phoneNumber.replace( /[\D]/gi, '')}%` : null,
        counselor: body.counselor || null,
        contactNumber: body.contactNumber || null,
        closedCases: typeof body.closedCases === 'undefined' || body.closedCases,
        limit: limit,
        offset: offset,
      }
      if (body.phoneNumber) {
        console.log('SEARCH QUERY:', statement, queryValues);
      }
      const result: CaseWithCount[] = await connection.any<CaseWithCount>(statement, queryValues);
      const count: number = result.length ? result[0].totalCount : 0;
      return { rows: result, count }
    });

  const cases = rows.map(addCategoriesAndChildName);

  return { cases, count };
};

export const deleteById = async (id, accountSid) => {
  return db.oneOrNone(DELETE_BY_ID,[accountSid, id]);
};

export const update = async (id, body: Record<string, unknown>, accountSid, workerSid): Promise<Case> => {
  const result = await db.tx(
    async transaction => {
      const caseRecordUpdates: Partial<NewCaseRecord> = {
        ...body,
        twilioWorkerId: workerSid,
        updatedAt: new Date().toISOString()
      }

      const updateById = updateByIdSql(caseRecordUpdates);
      console.log('pg-promise update SQL', updateById);
      const [original, updated] = await db.multi<Case>(updateById, { accountSid, caseId: id, });

      if (updated.length) {
        await logCaseAudit(transaction, updated[0], original[0]);
      }
      return updated;
    }
  );
  return result.length ? result[0] : void 0;
}

export const getAuditsForCase = async (accountSid, caseId): Promise<CaseAuditRecord[]> => {
  return db.any<CaseAuditRecord>(SELECT_CASE_AUDITS_FOR_CASE, { accountSid, caseId });
};
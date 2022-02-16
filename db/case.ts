import pool from './connection-pool';
import { JsonSqlToken, sql } from 'slonik';
import { getPaginationElements, retrieveCategories } from '../controllers/helpers';
import { Contact, ContactRecord } from './contact';
import { mapCaseRecordsetToObjectGraph } from './mapper';

type NewCaseRecord = {
  info: JsonSqlToken,
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
  createdAt: number;
  updatedAt: number;
}

export type Case = CaseRecord & {
  connectedContacts?: Contact[]
}

const CASE_FIELD_IDENTIFIERS = ['info','id','helpline','status','twilioWorkerId','createdBy','accountSid','createdAt','updatedAt'].map(key => sql.identifier(["Cases", key]));
const CONTACT_FIELD_IDENTIFIERS = ['rawJson','id','queueName','twilioWorkerId','createdBy','helpline','number','channel','conversationDuration', 'accountSid', 'timeOfContact', 'taskId', 'channelSid', 'serviceSid'].map(key => sql.identifier(["Contacts", key]));

type CaseAuditRecord = {
  previousValue?: JsonSqlToken,
  newValue?: JsonSqlToken,
  twilioWorkerId: string,
  createdBy: string,
  accountSid: string,
  createdAt: string,
  updatedAt: string,
  caseId: number
}

export type ExpandedCaseRecord = {case: CaseRecord, caseId: number, contact?: ContactRecord, contactId: number, csamReportRecord?: any}

export const create = async (body, accountSid, workerSid) : Promise<CaseRecord> => {
  const now = new Date();
  const caseRecord: NewCaseRecord = {
    info: sql.json(body.info),
    helpline: body.helpline,
    status: body.status || 'open',
    twilioWorkerId: body.twilioWorkerId,
    createdBy: workerSid,
    accountSid: accountSid,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };
  // Object.keys and Object.values could theoretically return things in a different order, so lets play safe
  const caseInsertEntries = Object.entries(caseRecord);
  return await pool.connect(
    async connection => {
      return connection.transaction(async transaction => {

        const statement = sql<CaseRecord>`INSERT INTO "Cases" (${sql.join(caseInsertEntries.map(e => sql.identifier([e[0]])), sql`, `)}) VALUES (${sql.join(caseInsertEntries.map(e => e[1]), sql`, `)}) RETURNING *`
        console.log('Executing (slonik):', statement);
        const inserted: CaseRecord = await transaction.one(statement);
        console.log('Executed (slonik):', statement);
        console.log('Result (slonik): ', inserted);
        const auditRecord: CaseAuditRecord = {
          caseId: inserted.id,
          createdAt: caseRecord.createdAt,
          updatedAt: caseRecord.updatedAt,
          createdBy: caseRecord.createdBy,
          accountSid,
          twilioWorkerId: inserted.twilioWorkerId,
          newValue: sql.json({
            ...inserted,
            contacts: []
          })
        }
        const auditRecordEntries = Object.entries(auditRecord);
        await transaction.query(sql`INSERT INTO "CaseAudits" (${sql.join(auditRecordEntries.map(e => sql.identifier([e[0]])), sql`, `)}) VALUES (${sql.join(auditRecordEntries.map(e => e[1]), sql`, `)}) RETURNING *`)
        return inserted;
      })
  });

};

export const list = async (query: { helpline: string}, accountSid): Promise<{ cases: readonly Case[], count: number}> => {
  const { limit, offset } = getPaginationElements(query);
  const { helpline } = query;

  const { count, rows } =  await pool.connect(
    async connection => {
      return connection.transaction(async transaction => {
        console.log("list", query, accountSid)
        const statement = sql`SELECT ${sql.join([...CASE_FIELD_IDENTIFIERS, ...CONTACT_FIELD_IDENTIFIERS], sql`, `)} FROM "Cases" LEFT JOIN "Contacts" ON "Cases"."id" = "Contacts"."caseId" WHERE "Cases"."accountSid" = ${accountSid} AND (cast(${helpline ?? null} as text) IS NULL OR "Cases"."helpline" = ${helpline ?? null}) ORDER BY "Cases"."createdAt"`;
        console.log('Executing (slonik):', statement);
        const rows: readonly ExpandedCaseRecord[] = await transaction.any<ExpandedCaseRecord>(statement);
        console.log('Executed (slonik):', statement);
        console.log('Result (slonik): ', rows);
        const count: number = await transaction.oneFirst<number>(sql`SELECT COUNT(*) FROM "Cases" WHERE "accountSid" = ${accountSid} AND (cast(${helpline ?? null} as text) IS NULL OR "helpline" = ${helpline ?? null})`);
        return { rows: mapCaseRecordsetToObjectGraph(rows), count }
      })
    })
  const cases = rows.map(caseItem => {
    const fstContact = caseItem.connectedContacts[0];

    if (!fstContact) {
      return {
        ...caseItem,
        childName: '',
        categories: retrieveCategories(undefined), // we call the function here so the return value allways matches
      };
    }

    const { childInformation, caseInformation } = fstContact.rawJson;
    const childName = `${childInformation.name.firstName} ${childInformation.name.lastName}`;
    const categories = retrieveCategories(caseInformation.categories);
    return { ...caseItem, childName, categories };
  });

  return { cases, count };
};
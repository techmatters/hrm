import pool from './connection-pool';
//import { JsonSqlToken, QueryResult, sql } from 'slonik';
import { getPaginationElements, retrieveCategories } from '../controllers/helpers';
import { Contact, ContactRecord } from './contact';
import { mapCaseRecordsetToObjectGraph } from './mapper';

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
  createdAt: number;
  updatedAt: number;
}

export type Case = CaseRecord & {
  connectedContacts?: Contact[]
}

//const CASE_FIELD_IDENTIFIERS = ['info','id','helpline','status','twilioWorkerId','createdBy','accountSid','createdAt','updatedAt'].map(key => `${sql.identifier(["Cases", key])} AS ${sql.identifier[`${key}`]}`);
//const CONTACT_FIELD_IDENTIFIERS = ['rawJson','id','queueName','twilioWorkerId','createdBy','helpline','number','channel', 'accountSid', 'timeOfContact', 'taskId', 'channelSid', 'serviceSid'].map(key => `${sql.identifier(["Contacts", key])} AS ${sql.identifier[`Contacts_${key}`]}`);

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

export const create = async (body, accountSid, workerSid) : Promise<CaseRecord> => {
  const now = new Date();
  const caseRecord: NewCaseRecord = {
    info: body.info,
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
  return await pool.task(
    async connection => {
      return connection.tx(async transaction => {
        const insertValues = caseInsertEntries.map(e => e[1]);
        const statement = `INSERT INTO "Cases" (${caseInsertEntries.map(e => `"${e[0]}"`).join(`, `)}) VALUES (${caseInsertEntries.map((v, idx) => `$${idx+1}`).join(`, `)}) RETURNING *`
        console.log('Executing (slonik):', statement, insertValues);
        const inserted: CaseRecord = await transaction.one(statement, ...insertValues);
        console.log('Executed (slonik):', statement, insertValues);
        console.log('Result (slonik): ', inserted);
        const auditRecord: CaseAuditRecord = {
          caseId: inserted.id,
          createdAt: caseRecord.createdAt,
          updatedAt: caseRecord.updatedAt,
          createdBy: caseRecord.createdBy,
          accountSid,
          twilioWorkerId: inserted.twilioWorkerId,
          newValue: {
            ...inserted,
            contacts: []
          }
        }
        const auditRecordEntries = Object.entries(auditRecord);
        await transaction.query(`INSERT INTO "CaseAudits" (${auditRecordEntries.map(e => `"${e[0]}"`).join(`, `)}) VALUES (${auditRecordEntries.map((v, idx) => `$${idx+1}`).join(`, `)}) RETURNING *`, ...auditRecordEntries.map(e => e[1]))
        return inserted;
      })
  });

};

export const list = async (query: { helpline: string}, accountSid): Promise<{ cases: readonly Case[], count: number}> => {
  const { limit, offset } = getPaginationElements(query);
  const { helpline } = query;

  const { count, rows } =  await pool.task(
    async connection => {
        console.log("list", query, accountSid)
        const contactsSelect =
`SELECT c.*,
COALESCE(jsonb_agg(DISTINCT r.*) FILTER (WHERE r.id IS NOT NULL), '[]') AS "csamReports"
FROM "Contacts" c LEFT JOIN "CSAMReports" r ON c."id" = r."contactId" WHERE c."caseId" = "cases".id
GROUP BY c.id`;
        const unordered =
    `SELECT DISTINCT ON (cases.id)
    (count(*) OVER())::INTEGER AS "totalCount",
    cases.*, CURRENT_TIMESTAMP::DATE AS "timestamp_test",
    COALESCE(jsonb_agg(DISTINCT contacts.*) FILTER (WHERE contacts.id IS NOT NULL), '[]') AS "connectedContacts"
FROM "Cases" cases LEFT JOIN LATERAL (${contactsSelect}) contacts ON true WHERE "cases"."accountSid" = $<accountSid> AND (cast($<helpline> as text) IS NULL OR "cases"."helpline" = $<helpline>) GROUP BY "cases"."id"`;
        const statement = `
SELECT * FROM (${unordered}) "unordered" ORDER BY "createdAt" DESC
LIMIT $<limit>
OFFSET $<offset>`
        const queryValues =  {accountSid, helpline, limit, offset}
        console.log('Executing ():', statement, queryValues);
        const result: Case[] = await connection.many<Case>(statement, queryValues);
        console.log('Executed (slonik):', statement);
        console.log('Result (slonik): ', result);
        const count: number = await connection.one<number>(`SELECT COUNT(*) AS "count" FROM "Cases" WHERE "accountSid" = $<accountSid> AND (cast($<helpline> as text) IS NULL OR "helpline" = $<helpline>)`,
          {accountSid, helpline});
        return { rows: result, count }

    })
  const cases = rows.map(caseItem => {
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
  });

  return { cases, count };
};
import pool from './connection-pool';
import { getPaginationElements, retrieveCategories } from '../controllers/helpers';
import { Contact } from './contact';



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

const SELECT_CONTACTS =
  `SELECT c.*,
COALESCE(jsonb_agg(DISTINCT r.*) FILTER (WHERE r.id IS NOT NULL), '[]') AS "csamReports"
FROM "Contacts" c LEFT JOIN "CSAMReports" r ON c."id" = r."contactId" WHERE c."caseId" = "cases".id
GROUP BY c.id`;

const LIST_WHERE_CLAUSE =  `WHERE "cases"."accountSid" = $<accountSid> AND (cast($<helpline> as text) IS NULL OR "cases"."helpline" = $<helpline>)`

const SEARCH_WHERE_CLAUSE = `WHERE
    (info IS NULL OR jsonb_typeof(info) = 'object')
    AND
      CASE WHEN $<helpline> IS NULL THEN TRUE
      ELSE  (
        cases.helpline = $<helpline>
      )
      END
    AND
      $<accountSid> IS NOT NULL AND cases."accountSid" = $<accountSid>
    AND
      CASE WHEN $<counselor> IS NULL THEN TRUE
      ELSE cases."twilioWorkerId" = $<counselor>
      END
    AND
      CASE WHEN $<dateFrom> IS NULL THEN TRUE
      ELSE cases."createdAt"::DATE >= $<dateFrom>::DATE
      END
    AND
      CASE WHEN $<dateTo> IS NULL THEN TRUE
      ELSE cases."createdAt"::DATE <= $<dateTo>::DATE
      END
    AND (

      -- search on childInformation of connectedContacts
      (
        CASE WHEN $<firstName> IS NULL THEN TRUE
        ELSE contacts."rawJson"->'childInformation'->'name'->>'firstName' ILIKE $<firstName>
        END
      AND
        CASE WHEN $<lastName> IS NULL THEN TRUE
        ELSE contacts."rawJson"->'childInformation'->'name'->>'lastName' ILIKE $<lastName>
        END
      AND
        CASE WHEN $<phoneNumber> IS NULL THEN TRUE
        ELSE (
          regexp_replace(contacts."rawJson"->'childInformation'->'location'->>'phone1', '\\D', '', 'g') ILIKE $<phoneNumber>
          OR regexp_replace(contacts."rawJson"->'childInformation'->'location'->>'phone2', '\\D', '', 'g') ILIKE $<phoneNumber>
          OR regexp_replace(contacts.number, '\\D', '', 'g') ILIKE $<phoneNumber>
        )
        END
      )

      -- search on callerInformation of connectedContacts
    OR ( 
          CASE WHEN $<firstName> IS NULL THEN TRUE
          ELSE contacts."rawJson"->'callerInformation'->'name'->>'firstName' ILIKE $<firstName>
          END
        AND
          CASE WHEN $<lastName> IS NULL THEN TRUE
          ELSE contacts."rawJson"->'callerInformation'->'name'->>'lastName' ILIKE $<lastName>
          END
        AND
          CASE WHEN $<phoneNumber> IS NULL THEN TRUE
          ELSE (
            regexp_replace(contacts."rawJson"->'callerInformation'->'location'->>'phone1', '\\D', '', 'g') ILIKE $<phoneNumber>
            OR regexp_replace(contacts."rawJson"->'callerInformation'->'location'->>'phone2', '\\D', '', 'g') ILIKE $<phoneNumber>
            OR regexp_replace(contacts.number, '\\D', '', 'g') ILIKE $<phoneNumber>
          )
          END
        )

      -- search on households
    OR (
          CASE WHEN $<firstName> IS NULL THEN TRUE
          ELSE h.value->'household'->>'firstName' ILIKE $<firstName>
          END
        AND
          CASE WHEN $<lastName> IS NULL THEN TRUE
          ELSE h.value->'household'->>'lastName' ILIKE $<lastName>
          END
        AND
          CASE WHEN $<phoneNumber> IS NULL THEN TRUE
          ELSE (
            regexp_replace(h.value->'household'->>'phone1', '\\D', '', 'g') ILIKE $<phoneNumber>
            OR regexp_replace(h.value->'household'->>'phone2', '\\D', '', 'g') ILIKE $<phoneNumber>
          )
          END
        )

      -- search on perpetrators
    OR (
          CASE WHEN $<firstName> IS NULL THEN TRUE
          ELSE p.value->'perpetrator'->>'firstName' ILIKE $<firstName>
          END
        AND
          CASE WHEN $<lastName> IS NULL THEN TRUE
          ELSE p.value->'perpetrator'->>'lastName' ILIKE $<lastName>
          END
        AND
          CASE WHEN $<phoneNumber> IS NULL THEN TRUE
          ELSE (
            regexp_replace(p.value->'perpetrator'->>'phone1', '\\D', '', 'g') ILIKE $<phoneNumber>
            OR regexp_replace(p.value->'perpetrator'->>'phone2', '\\D', '', 'g') ILIKE $<phoneNumber>
          )
          END
        )
    )
    -- previous contacts search
    AND
      CASE WHEN $<contactNumber> IS NULL THEN TRUE
      ELSE contacts.number = $<contactNumber>
      END`

const SEARCH_HAVING_CLAUSE = `  
  -- Needed a HAVING clause because we couldn't do aggregations on WHERE clauses
  HAVING
    -- search on closedCases and orphaned cases (without connected contacts)
    CASE WHEN $<closedCases>::BOOLEAN = FALSE THEN (
      cases.status <> 'closed'
      AND jsonb_array_length(COALESCE(jsonb_agg(DISTINCT contacts.*) FILTER (WHERE contacts.id IS NOT NULL), '[]')) > 0
    )
    ELSE TRUE
    END`

const selectCasesUnorderedSql = (whereClause: string, havingClause: string = '') =>
  `SELECT DISTINCT ON (cases.id)
    (count(*) OVER())::INTEGER AS "totalCount",
    cases.*,
    COALESCE(jsonb_agg(DISTINCT contacts.*) FILTER (WHERE contacts.id IS NOT NULL), '[]') AS "connectedContacts"
FROM "Cases" cases LEFT JOIN LATERAL (${SELECT_CONTACTS}) contacts ON true ${whereClause} GROUP BY "cases"."id" ${havingClause}`;

const selectCasesPaginatedSql = (whereClause: string, havingClause: string = '') => `
SELECT * FROM (${selectCasesUnorderedSql(whereClause, havingClause)}) "unordered" ORDER BY "createdAt" DESC
LIMIT $<limit>
OFFSET $<offset>`

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
        const inserted: CaseRecord = await transaction.one(statement, insertValues);
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
        await transaction.none(`INSERT INTO "CaseAudits" (${auditRecordEntries.map(e => `"${e[0]}"`).join(`, `)}) VALUES (${auditRecordEntries.map((v, idx) => `$${idx+1}`).join(`, `)})`, auditRecordEntries.map(e => e[1]))
        return inserted;
      })
  });
};

export const list = async (query: { helpline: string}, accountSid): Promise<{ cases: readonly Case[], count: number}> => {
  const { limit, offset } = getPaginationElements(query);
  const { helpline } = query;

  const { count, rows } =  await pool.task(
    async connection => {
        console.log("list", query, accountSid);
        const statement = selectCasesPaginatedSql(LIST_WHERE_CLAUSE)
        const queryValues =  {accountSid, helpline, limit, offset}
        console.log('Executing ():', statement, queryValues);
        const result: Case[] = await connection.any<Case>(statement, queryValues);
        console.log('Executed (slonik):', statement);
        console.log('Result (slonik): ', result);
        const { count } = await connection.one<{count: number}>(`SELECT COUNT(*)::INTEGER AS "count" FROM "Cases" WHERE "accountSid" = $<accountSid> AND (cast($<helpline> as text) IS NULL OR "helpline" = $<helpline>)`,
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


export const search = async (body, query: { helpline: string}, accountSid): Promise<{ cases: readonly Case[], count: number}> => {
  const { limit, offset } = getPaginationElements(query);
  const { helpline } = query;

  const { count, rows } =  await pool.task(
    async connection => {
      console.log("list", query, accountSid);
      const statement = selectCasesPaginatedSql(SEARCH_WHERE_CLAUSE, SEARCH_HAVING_CLAUSE)
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
      console.log('Executing ():', statement, queryValues);
      const result: Case[] = await connection.any<Case>(statement, queryValues);
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
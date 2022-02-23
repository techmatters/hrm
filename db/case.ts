import pool from './connection-pool';
import { getPaginationElements, retrieveCategories } from '../controllers/helpers';
import { Contact } from './contact';
import pgPromise from 'pg-promise';

const VALID_CASE_UPDATE_FIELDS = [
  'info',
  'helpline',
  'status',
]

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

const SELECT_CONTACTS =
  `SELECT c.*,
COALESCE(jsonb_agg(DISTINCT r.*) FILTER (WHERE r.id IS NOT NULL), '[]') AS "csamReports"
FROM "Contacts" c LEFT JOIN "CSAMReports" r ON c."id" = r."contactId" WHERE c."caseId" = "cases".id
GROUP BY c.id`;

const SEARCH_FROM_EXTRAS = `    
  -- Transform "info" column as a table with columns "households" and "perpetrators"
  CROSS JOIN jsonb_to_record(info) AS info_as_table(households jsonb, perpetrators jsonb)
  -- Extract every household/perpetrator as a record and apply a join
  LEFT JOIN LATERAL jsonb_array_elements(households::JSONB) h ON TRUE
  LEFT JOIN LATERAL jsonb_array_elements(perpetrators::JSONB) p ON TRUE`

const LIST_WHERE_CLAUSE =  `WHERE "cases"."accountSid" = $<accountSid> AND (cast($<helpline> as text) IS NULL OR "cases"."helpline" = $<helpline>)`

const ID_WHERE_CLAUSE =  `WHERE "cases"."accountSid" = $<accountSid> AND "cases"."id" = $<caseId>`

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


const selectCasesUnorderedSql = (whereClause: string, extraFromClause: string = '', havingClause: string = '') =>
  `SELECT DISTINCT ON (cases.id)
    (count(*) OVER())::INTEGER AS "totalCount",
    cases.*,
    COALESCE(jsonb_agg(DISTINCT contacts.*) FILTER (WHERE contacts.id IS NOT NULL), '[]') AS "connectedContacts"
    FROM "Cases" cases 
    ${extraFromClause}
    LEFT JOIN LATERAL (${SELECT_CONTACTS}) contacts ON true ${whereClause} GROUP BY "cases"."id" ${havingClause}`;

const selectCasesPaginatedSql = (whereClause: string, extraFromClause: string = '', havingClause: string = '') => `
SELECT * FROM (${selectCasesUnorderedSql(whereClause, extraFromClause, havingClause)}) "unordered" ORDER BY "createdAt" DESC
LIMIT $<limit>
OFFSET $<offset>`

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

  const auditRecordEntries = Object.entries(auditRecord);
  await transaction.none(`INSERT INTO "CaseAudits" (${auditRecordEntries.map(e => `"${e[0]}"`).join(`, `)}) VALUES (${auditRecordEntries.map((v, idx) => `$${idx+1}`).join(`, `)})`, auditRecordEntries.map(e => e[1]))

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
  // Object.keys and Object.values could theoretically return things in a different order, so lets play safe
  const caseInsertEntries = Object.entries(caseRecord);
  return await pool.task(
    async connection => {
      return connection.tx(async transaction => {
        const insertValues = caseInsertEntries.map(e => e[1]);
        const statement = `INSERT INTO "Cases" (${caseInsertEntries.map(e => `"${e[0]}"`).join(`, `)}) VALUES (${caseInsertEntries.map((v, idx) => `$${idx+1}`).join(`, `)}) RETURNING *`
        const inserted: CaseRecord = await transaction.one(statement, insertValues);
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

  const { count, rows } =  await pool.task(
    async connection => {
        console.log("list", query, accountSid);
        const statement = selectCasesPaginatedSql(LIST_WHERE_CLAUSE)
        const queryValues =  {accountSid, helpline, limit, offset}
        const result: CaseWithCount[] = await connection.any<CaseWithCount>(statement, queryValues);
        const count = result.length ? result[0].totalCount : 0;
        return { rows: result, count }
    });

  const cases = rows.map(addCategoriesAndChildName);

  return { cases, count };
};

export const search = async (body, query: { helpline: string}, accountSid): Promise<{ cases: readonly Case[], count: number}> => {
  const { limit, offset } = getPaginationElements(query);

  const { count, rows } =  await pool.task(
    async connection => {
      console.log("list", query, accountSid);
      const statement = selectCasesPaginatedSql(SEARCH_WHERE_CLAUSE, SEARCH_FROM_EXTRAS, SEARCH_HAVING_CLAUSE)
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
      const result: CaseWithCount[] = await connection.any<CaseWithCount>(statement, queryValues);
      const count: number = result.length ? result[0].totalCount : 0;
      return { rows: result, count }
    });

  const cases = rows.map(addCategoriesAndChildName);

  return { cases, count };
};

export const deleteById = async (id, accountSid) => {
  return pool.oneOrNone(`DELETE FROM "Cases" WHERE "Cases"."accountSid" = $1 AND "Cases"."id" = $2 RETURNING *`,[accountSid, id]);
};

export const update = async (id, body, accountSid, workerSid): Promise<Case> => {
  const filtered = Object.entries(body).filter(([key,])=>VALID_CASE_UPDATE_FIELDS.includes(key));
  console.log('Input body:', body, Object.entries(body), filtered);
  const update = Object.fromEntries(filtered);
  const result = await pool.tx(
    async transaction => {
      const caseRecordUpdates: Partial<NewCaseRecord> = {
        ...update,
        twilioWorkerId: workerSid,
        updatedAt: new Date().toISOString()
      }
      const caseRecordUpdateEntries = Object.entries(caseRecordUpdates)
      const updateById = `
        SELECT
          cases.*,
          contacts."connectedContacts"
          FROM "Cases" AS cases
          LEFT JOIN LATERAL ( 
          SELECT COALESCE(jsonb_agg(to_jsonb(row(c, reports))), '[]') AS  "connectedContacts" 
          FROM "Contacts" c 
          LEFT JOIN LATERAL (
            SELECT COALESCE(jsonb_agg(to_jsonb(row(r))), '[]') AS  "csamReports" 
            FROM "CSAMReports" r 
            WHERE r."contactId" = c.id
          ) reports ON true
          WHERE c."caseId" = cases.id
        ) contacts ON true
        ${ID_WHERE_CLAUSE};
      WITH 
      updated AS (
        UPDATE "Cases" AS "cases" SET ${caseRecordUpdateEntries.map(([field, ]) => `"${field}" = $<${field}>`)} ${ID_WHERE_CLAUSE} RETURNING *
      )
      SELECT
        cases.*,
        contacts."connectedContacts"
        FROM updated AS cases
        LEFT JOIN LATERAL ( 
        SELECT COALESCE(jsonb_agg(to_jsonb(row(c, reports))), '[]') AS  "connectedContacts" 
        FROM "Contacts" c 
        LEFT JOIN LATERAL (
          SELECT COALESCE(jsonb_agg(to_jsonb(row(r))), '[]') AS  "csamReports" 
          FROM "CSAMReports" r 
          WHERE r."contactId" = c.id
        ) reports ON true
        WHERE c."caseId" = cases.id
		  ) contacts ON true
      ${ID_WHERE_CLAUSE}`;
      const updateValues = { accountSid, caseId: id, ...caseRecordUpdates };
      console.log("Update SQL:", updateById, updateValues);
      const [original, updated] = await pool.multi<Case>(updateById, updateValues);
      console.log("Updated record:",original, updated);
      if (updated.length) {
        await logCaseAudit(transaction, updated[0], original[0]);
      }
      return updated;
    }
  );
  return result.length ? result[0] : void 0;
}

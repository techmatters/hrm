import { pgp } from '../connection-pool';

export const enum OrderByDirection {
  ascendingNullsLast = 'ASC NULLS LAST',
  descendingNullsLast = 'DESC NULLS LAST',
  ascending = 'ASC',
  descending = 'DESC',
}

const VALID_CASE_UPDATE_FIELDS = ['info', 'helpline', 'status', 'twilioWorkerId', 'updatedAt'];

type OrderByClauseItem = { sortField: string; sortDirection: OrderByDirection };

const DEFAULT_SORT: OrderByClauseItem[] = [
  { sortField: 'id', sortDirection: OrderByDirection.descending },
];

const updateCaseColumnSet = new pgp.helpers.ColumnSet(
  VALID_CASE_UPDATE_FIELDS.map(f => ({
    name: f,
    skip: val => !val.exists,
  })),
  { table: 'Cases' },
);

const generateOrderByClause = (
  clauses: { sortField: string; sortDirection: OrderByDirection }[],
): string => {
  if (clauses.length > 0) {
    return ` ORDER BY ${clauses
      .map(t => `${pgp.as.name(t.sortField)} ${t.sortDirection}`)
      .join(', ')}`;
  } else return '';
};

const SELECT_CONTACTS = `SELECT c.*,
COALESCE(jsonb_agg(DISTINCT r.*) FILTER (WHERE r.id IS NOT NULL), '[]') AS "csamReports"
FROM "Contacts" c LEFT JOIN "CSAMReports" r ON c."id" = r."contactId" WHERE c."caseId" = "cases".id
GROUP BY c.id`;

const SEARCH_FROM_EXTRAS = `    
  -- Transform "info" column as a table with columns "households" and "perpetrators"
  CROSS JOIN jsonb_to_record(info) AS info_as_table(households jsonb, perpetrators jsonb)
  -- Extract every household/perpetrator as a record and apply a join
  LEFT JOIN LATERAL jsonb_array_elements(households::JSONB) h ON TRUE
  LEFT JOIN LATERAL jsonb_array_elements(perpetrators::JSONB) p ON TRUE`;

const LIST_WHERE_CLAUSE = `WHERE "cases"."accountSid" = $<accountSid> AND (cast($<helpline> as text) IS NULL OR "cases"."helpline" = $<helpline>)`;

const ID_WHERE_CLAUSE = `WHERE "cases"."accountSid" = $<accountSid> AND "cases"."id" = $<caseId>`;

const nameAndPhoneNumberSearchSql = (
  firstNameSource: string,
  lastNameSource: string,
  phoneNumberColumns: string[],
) =>
  `CASE WHEN $<firstName> IS NULL THEN TRUE
        ELSE ${firstNameSource} ILIKE $<firstName>
        END
      AND
        CASE WHEN $<lastName> IS NULL THEN TRUE
        ELSE ${lastNameSource} ILIKE $<lastName>
        END
      AND
        CASE WHEN $<phoneNumber> IS NULL THEN TRUE
        ELSE (
          ${phoneNumberColumns
            .map(pn => `regexp_replace(${pn}, '\\D', '', 'g') ILIKE $<phoneNumber>`)
            .join('\n OR ')}
        )
        END`;

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
        ${nameAndPhoneNumberSearchSql(
          "contacts.\"rawJson\"->'childInformation'->'name'->>'firstName'",
          "contacts.\"rawJson\"->'childInformation'->'name'->>'lastName'",
          [
            "contacts.\"rawJson\"->'childInformation'->'location'->>'phone1'",
            "contacts.\"rawJson\"->'childInformation'->'location'->>'phone2'",
            'contacts.number',
          ],
        )}  
      )
        -- search on callerInformation of connectedContacts
      OR ( 
        ${nameAndPhoneNumberSearchSql(
          "contacts.\"rawJson\"->'callerInformation'->'name'->>'firstName'",
          "contacts.\"rawJson\"->'callerInformation'->'name'->>'lastName'",
          [
            "contacts.\"rawJson\"->'callerInformation'->'location'->>'phone1'",
            "contacts.\"rawJson\"->'callerInformation'->'location'->>'phone2'",
            'contacts.number',
          ],
        )}  
      )
        -- search on households
      OR (
        ${nameAndPhoneNumberSearchSql(
          "h.value->'household'->>'firstName'",
          "h.value->'household'->>'lastName'",
          ["h.value->'household'->>'phone1'", "h.value->'household'->>'phone2'"],
        )}
       )
  
        -- search on perpetrators
      OR (
        ${nameAndPhoneNumberSearchSql(
          "p.value->'perpetrator'->>'firstName'",
          "p.value->'perpetrator'->>'lastName'",
          ["p.value->'perpetrator'->>'phone1'", "p.value->'perpetrator'->>'phone2'"],
        )}
      )
    )
    -- previous contacts search
    AND
      CASE WHEN $<contactNumber> IS NULL THEN TRUE
      ELSE contacts.number = $<contactNumber>
      END`;

const SEARCH_HAVING_CLAUSE = `  
  -- Needed a HAVING clause because we couldn't do aggregations on WHERE clauses
  HAVING
    -- search on closedCases and orphaned cases (without connected contacts)
    CASE WHEN $<closedCases>::BOOLEAN = FALSE THEN (
      cases.status <> 'closed'
      AND jsonb_array_length(COALESCE(jsonb_agg(DISTINCT contacts.*) FILTER (WHERE contacts.id IS NOT NULL), '[]')) > 0
    )
    ELSE TRUE
    END
`;

export const selectSingleCaseByIdSql = (tableName: string) => `SELECT
        cases.*,
        caseSections."caseSections",
        contacts."connectedContacts"
        FROM "${tableName}" AS cases

        LEFT JOIN LATERAL ( 
        SELECT COALESCE(jsonb_agg(to_jsonb(c) || to_jsonb(reports)), '[]') AS  "connectedContacts" 
        FROM "Contacts" c 
        LEFT JOIN LATERAL (
          SELECT COALESCE(jsonb_agg(to_jsonb(r)), '[]') AS  "csamReports" 
          FROM "CSAMReports" r 
          WHERE r."contactId" = c.id
        ) reports ON true
        WHERE c."caseId" = cases.id
      ) contacts ON true
        LEFT JOIN LATERAL (
          SELECT COALESCE(jsonb_agg(to_jsonb(cs)), '[]') AS  "caseSections" 
          FROM "CaseSections" cs
          WHERE cs."caseId" = cases.id
        ) caseSections ON true
      ${ID_WHERE_CLAUSE}`;

const selectCasesUnorderedSql = (
  whereClause: string,
  extraFromClause: string = '',
  havingClause: string = '',
) =>
  `SELECT DISTINCT ON (cases.id)
    (count(*) OVER())::INTEGER AS "totalCount",
    cases.*,
    COALESCE(jsonb_agg(DISTINCT contacts.*) FILTER (WHERE contacts.id IS NOT NULL), '[]') AS "connectedContacts"
    FROM "Cases" cases 
    ${extraFromClause}
    LEFT JOIN LATERAL (${SELECT_CONTACTS}) contacts ON true ${whereClause} GROUP BY "cases"."id" ${havingClause}`;

const selectCasesPaginatedSql = (
  whereClause: string,
  orderByClause: string,
  extraFromClause: string = '',
  havingClause: string = '',
) => `
SELECT * FROM (${selectCasesUnorderedSql(
  whereClause,
  extraFromClause,
  havingClause,
)}) "unordered" ${orderByClause}
LIMIT $<limit>
OFFSET $<offset>`;

export const SELECT_CASE_SEARCH = selectCasesPaginatedSql(
  SEARCH_WHERE_CLAUSE,
  generateOrderByClause(DEFAULT_SORT),
  SEARCH_FROM_EXTRAS,
  SEARCH_HAVING_CLAUSE,
);

export const DELETE_BY_ID = `DELETE FROM "Cases" WHERE "Cases"."accountSid" = $1 AND "Cases"."id" = $2 RETURNING *`;

export const updateByIdSql = (updatedValues: Record<string, unknown>) => `
      ${selectSingleCaseByIdSql('Cases')};
      WITH 
      updated AS (
        ${pgp.helpers.update(updatedValues, updateCaseColumnSet)} 
          WHERE "Cases"."accountSid" = $<accountSid> AND "Cases"."id" = $<caseId> 
          RETURNING *
      )
      ${selectSingleCaseByIdSql('updated')}
`;

export const selectCaseList = (
  orderByClauses: { sortField: string; sortDirection: OrderByDirection }[] = [],
) => {
  const orderBySql = generateOrderByClause(orderByClauses.concat(DEFAULT_SORT));
  return selectCasesPaginatedSql(LIST_WHERE_CLAUSE, orderBySql);
};

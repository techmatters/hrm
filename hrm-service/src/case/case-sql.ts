import { pgp } from '../connection-pool';
import { SELECT_CASE_SECTIONS } from './case-sections-sql';

export const enum OrderByDirection {
  ascendingNullsLast = 'ASC NULLS LAST',
  descendingNullsLast = 'DESC NULLS LAST',
  ascending = 'ASC',
  descending = 'DESC',
}

const VALID_CASE_UPDATE_FIELDS = ['info', 'helpline', 'status', 'twilioWorkerId', 'updatedAt'];

const ORDER_BY_FIELDS_MAP = {
  'info.followUpDate': `"info"->>'followUpDate'`,
};

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
      .map(
        t => `${ORDER_BY_FIELDS_MAP[t.sortField] ?? pgp.as.name(t.sortField)} ${t.sortDirection}`,
      )
      .join(', ')}`;
  } else return '';
};

const SELECT_CONTACTS = `SELECT COALESCE(jsonb_agg(DISTINCT contacts.*) FILTER (WHERE contacts."caseId" IS NOT NULL), '[]') AS "connectedContacts"
FROM (
  SELECT
    c.*,
    COALESCE(jsonb_agg(DISTINCT r.*) FILTER (WHERE r.id IS NOT NULL), '[]') AS "csamReports"
  FROM "Contacts" c 
  LEFT JOIN "CSAMReports" r ON c."id" = r."contactId" 
  WHERE c."caseId" = "cases".id
  GROUP BY c.id
) AS contacts WHERE contacts."caseId" = cases.id`;

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
      ($<firstName> IS NULL AND $<lastName> IS NULL AND $<phoneNumber> IS NULL) OR
      EXISTS (
        SELECT 1 FROM "Contacts" c WHERE c."caseId" = cases.id 
          AND (
            (
            ${nameAndPhoneNumberSearchSql(
              "c.\"rawJson\"->'childInformation'->'name'->>'firstName'",
              "c.\"rawJson\"->'childInformation'->'name'->>'lastName'",
              [
                "c.\"rawJson\"->'childInformation'->'location'->>'phone1'",
                "c.\"rawJson\"->'childInformation'->'location'->>'phone2'",
                'c.number',
              ],
            )})
            -- search on callerInformation of connectedContacts
            OR ( 
              ${nameAndPhoneNumberSearchSql(
                "c.\"rawJson\"->'callerInformation'->'name'->>'firstName'",
                "c.\"rawJson\"->'callerInformation'->'name'->>'lastName'",
                [
                  "c.\"rawJson\"->'callerInformation'->'location'->>'phone1'",
                  "c.\"rawJson\"->'callerInformation'->'location'->>'phone2'",
                ],
              )}  
            )
          )
      )
      -- search on case sections in the expected format
      OR EXISTS (
        SELECT 1 FROM "CaseSections" cs WHERE cs."caseId" = cases.id
          AND
          ${nameAndPhoneNumberSearchSql(
            'cs."sectionTypeSpecificData"->>\'firstName\'',
            'cs."sectionTypeSpecificData"->>\'lastName\'',
            [
              'cs."sectionTypeSpecificData"->>\'phone1\'',
              'cs."sectionTypeSpecificData"->>\'phone2\'',
            ],
          )}
      )
    )
    AND (
      $<contactNumber> IS NULL OR
      EXISTS (
        SELECT 1 FROM "Contacts" c WHERE c."caseId" = cases.id AND c.number = $<contactNumber>
      )
    )`;

const SEARCH_HAVING_CLAUSE = `  
  -- Needed a HAVING clause because we couldn't do aggregations on WHERE clauses
  HAVING
    -- search on closedCases and orphaned cases (without connected contacts)
    CASE WHEN $<closedCases>::BOOLEAN = FALSE THEN (
      cases.status <> 'closed'
      AND jsonb_array_length(contacts."connectedContacts") > 0
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

const selectCasesUnorderedSql = (whereClause: string, havingClause: string = '') =>
  `SELECT DISTINCT ON (cases.id)
    (count(*) OVER())::INTEGER AS "totalCount",
    cases.*,
    contacts."connectedContacts",
    NULLIF(
      CONCAT(
        contacts."connectedContacts"::JSONB#>>'{0, "rawJson", "childInformation", "name", "firstName"}', 
        ' ', 
        contacts."connectedContacts"::JSONB#>>'{0, "rawJson", "childInformation", "name", "lastName"}'
      )
    , ' ') AS "childName",  
    caseSections."caseSections"
    FROM "Cases" cases 
    LEFT JOIN LATERAL (${SELECT_CONTACTS}) contacts ON true 
    LEFT JOIN LATERAL (${SELECT_CASE_SECTIONS}) caseSections ON true
    ${whereClause} GROUP BY "cases"."id", caseSections."caseSections", contacts."connectedContacts" ${havingClause}`;

const selectCasesPaginatedSql = (
  whereClause: string,
  orderByClause: string,
  havingClause: string = '',
) => `
SELECT * FROM (${selectCasesUnorderedSql(whereClause, havingClause)}) "unordered" ${orderByClause}
LIMIT $<limit>
OFFSET $<offset>`;

export const SELECT_CASE_SEARCH = selectCasesPaginatedSql(
  SEARCH_WHERE_CLAUSE,
  generateOrderByClause(DEFAULT_SORT),
  SEARCH_HAVING_CLAUSE,
);

export const DELETE_BY_ID = `DELETE FROM "Cases" WHERE "Cases"."accountSid" = $1 AND "Cases"."id" = $2 RETURNING *`;

export const updateByIdSql = (updatedValues: Record<string, unknown>) => `WITH updated AS (
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

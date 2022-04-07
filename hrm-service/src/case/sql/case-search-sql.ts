import { pgp } from '../../connection-pool';
import { SELECT_CASE_SECTIONS } from './case-sections-sql';
import { CaseListFilters } from '../case-data-access';

export const enum OrderByDirection {
  ascendingNullsLast = 'ASC NULLS LAST',
  descendingNullsLast = 'DESC NULLS LAST',
  ascending = 'ASC',
  descending = 'DESC',
}

export const enum OrderByColumns {
  ID = 'id',
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  CHILD_NAME = 'childName',
  FOLLOW_UP_DATE = 'info.followUpDate',
}

const ORDER_BY_FIELDS: Record<OrderByColumns, string> = {
  id: pgp.as.name('id'),
  createdAt: pgp.as.name('createdAt'),
  updatedAt: 'updatedAt',
  'info.followUpDate': `"info"->>'followUpDate'`,
  childName: pgp.as.name('childName'),
} as const;

type OrderByClauseItem = { sortBy: string; sortDirection: OrderByDirection };

const DEFAULT_SORT: OrderByClauseItem[] = [
  { sortBy: 'id', sortDirection: OrderByDirection.descending },
];

const generateOrderByClause = (clauses: OrderByClauseItem[]): string => {
  const validClauses = clauses.filter(c => ORDER_BY_FIELDS[c.sortBy]);
  if (clauses.length > 0) {
    return ` ORDER BY ${validClauses
      .map(t => `${ORDER_BY_FIELDS[t.sortBy]} ${t.sortDirection}`)
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

const filterSql = ({
  counsellors,
  statuses,
  createdAt = {},
  helplines,
  excludedStatuses,
  includeOrphans,
}: CaseListFilters) => {
  const filterSqlClauses: string[] = [];
  if (helplines && helplines.length) {
    filterSqlClauses.push(pgp.as.format(`cases."helpline" IN ($<helplines:csv>)`, { helplines }));
  }
  if (counsellors && counsellors.length) {
    filterSqlClauses.push(
      pgp.as.format(`cases."twilioWorkerId" IN ($<counsellors:csv>)`, { counsellors }),
    );
  }
  if (excludedStatuses && excludedStatuses.length) {
    filterSqlClauses.push(
      pgp.as.format(`cases."status" NOT IN ($<excludedStatuses:csv>)`, { excludedStatuses }),
    );
  }
  if (statuses && statuses.length) {
    filterSqlClauses.push(pgp.as.format(`cases."status" IN ($<statuses:csv>)`, { statuses }));
  }
  if (createdAt && (createdAt.from || createdAt.to)) {
    filterSqlClauses.push(
      pgp.as.format(
        `(($<from> IS NULL OR cases."createdAt"::DATE > $<from>::DATE) AND ($<to> IS NULL OR cases."createdAt" < $<to>::DATE))`,
        createdAt,
      ),
    );
  }
  if (!includeOrphans) {
    filterSqlClauses.push(`jsonb_array_length(contacts."connectedContacts") > 0`);
  }
  return filterSqlClauses.join(`
  AND `);
};

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

const SEARCH_WHERE_CLAUSE = `(
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

export const selectCaseList = (orderByClauses: OrderByClauseItem[] = []) => {
  const orderBySql = generateOrderByClause(orderByClauses.concat(DEFAULT_SORT));
  return selectCasesPaginatedSql(LIST_WHERE_CLAUSE, orderBySql);
};

export const selectCaseSearch = (
  filters: CaseListFilters,
  orderByClauses: OrderByClauseItem[] = [],
) => {
  const whereSql = [
    `WHERE
    (info IS NULL OR jsonb_typeof(info) = 'object')
    AND
      $<accountSid> IS NOT NULL AND cases."accountSid" = $<accountSid>`,
    SEARCH_WHERE_CLAUSE,
    filterSql(filters),
  ].filter(sql => sql).join(`
  AND `);
  const orderBySql = generateOrderByClause(orderByClauses.concat(DEFAULT_SORT));
  return selectCasesPaginatedSql(whereSql, orderBySql);
};

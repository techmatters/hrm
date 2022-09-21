import { db, pgp } from '../connection-pool';
import { getPaginationElements } from '../controllers/helpers';
import { updateByIdSql } from './sql/case-update-sql';
import { OrderByColumnType, OrderByDirectionType, selectCaseSearch } from './sql/case-search-sql';
import { caseSectionUpsertSql, deleteMissingCaseSectionsSql } from './sql/case-sections-sql';
import { DELETE_BY_ID } from './sql/case-delete-sql';
import { selectSingleCaseByIdSql } from './sql/case-get-sql';
import { Contact } from '../contact/contact-data-access';

/**
 * @openapi
 * components:
 *   schemas:
 *     CaseRecordBase:
 *       type: object
 *       required:
 *         - status
 *         - helpline
 *         - info
 *         - twilioWorkerId
 *       properties:
 *         info:
 *           type: object
 *           example: { "notes": "Child with covid-19" }
 *         helpline:
 *           type: string
 *           example: helpline-1
 *         status:
 *           type: string
 *           example: open
 *         twilioWorkerId:
 *           type: string
 *           example: WZd3d289370720216aab7e3dc023e80f5f
 *         accountSid:
 *           type: string
 *           example: ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
 *     CaseRecordCommon:
 *       allOf:
 *         - $ref: '#/components/schemas/SequelizeRecord'
 *         - $ref: '#/components/schemas/CaseRecordBase'
 *
 */
export type CaseRecordCommon = {
  info: any;
  helpline: string;
  status: string;
  twilioWorkerId: string;
  createdBy: string;
  updatedBy: string;
  accountSid: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * @openapi
 * components:
 *   schemas:
 *     NewCaseRecord:
 *       allOf:
 *         - $ref: '#/components/schemas/CaseRecordCommon'
 *         - type: object
 *           properties:
 *             caseSections:
 *               $ref: '#/components/schemas/CaseSectionRecord'
 */
export type NewCaseRecord = CaseRecordCommon & {
  caseSections?: CaseSectionRecord[];
};

/**
 * @openapi
 * components:
 *   schemas:
 *     CaseRecord:
 *       allOf:
 *         - $ref: '#/components/schemas/CaseRecordCommon'
 *         - $ref: '#/components/schemas/ObjectHasId'
 *         - connectedContacts:
 *           type: array
 *           items:
 *             allOf:
 *               - $ref: '#/components/schemas/Contact'
 * #TODO: fill in the rest
 */
export type CaseRecord = CaseRecordCommon & {
  id: number;
  connectedContacts?: Contact[];
  caseSections?: CaseSectionRecord[];
};

/**
 * @openapi
 * components:
 *   schemas:
 *     CaseWithCount:
 *       allOf:
 *         - $ref: '#/components/schemas/CaseRecord'
 *         - $ref: '#/components/schemas/ObjectHasId'
 *         - totalCount:
 *           type: number
 *           example: 1
 */
type CaseWithCount = CaseRecord & { totalCount: number };

/**
 * @openapi
 * components:
 *   schemas:
 *     CaseSectionRecord:
 *      allOf:
 *        - $ref: '#/components/schemas/SequelizeRecord'
 *        - type: object
 *          properties:
 *            caseId:
 *              type: number
 *              example: 1
 *            sectionType:
 *              type: string
 *              example: notes
 *            sectionId:
 *              type: string
 *            sectionTypeSpecificData:
 *              type: string
 *            accountSid:
 *              type: string
 *            createdAt:
 *              type: string
 *            createdBy:
 *              type: string
 * #TODO: fill in the rest
 */
export type CaseSectionRecord = {
  caseId?: number;
  sectionType: string;
  sectionId: string;
  sectionTypeSpecificData: Record<string, any>;
  accountSid: string;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  updatedBy?: string;
};

/**
 * @openapi
 * components:
 *   parameters:
 *     OrderByColumn:
 *       in: query
 *       name: sortBy
 *       required: false
 *       schema:
 *         $ref: '#/components/schemas/OrderByColumn'
 *     OrderByDirection:
 *       in: query
 *       name: sortDirection
 *       required: false
 *       schema:
 *         $ref: '#/components/schemas/OrderByDirection'
 *       description: >
 *         Sort Order:
 *           * `ASC NULLS LAST` - ascending order, nulls last
 *           * `DESC NULLS LAST` - descending order, nulls last
 *           * `ASC` - ascending order, nulls first
 *           * `DESC` - descending order, nulls first
 *     Offset:
 *       in: query
 *       name: offset
 *       required: false
 *       schema:
 *         type: number
 *     Limit:
 *       in: query
 *       name: limit
 *       required: false
 *       schema:
 *         type: number
 *
 * # this doesn't seem to work as a parameter list unfortunately. Be
 * # sure to update param lists in /cases/search and /cases get endpoints
 * # if you update this.
 *
 * definitions:
 *   CaseListConfiguration:
 *     type: array
 *     items:
 *       - $ref: '#/components/parameters/OrderByColumn'
 *       - $ref: '#/components/parameters/OrderByDirection'
 *       - $ref: '#/components/parameters/Offset'
 *       - $ref: '#/components/parameters/Limit'
 */
export type CaseListConfiguration = {
  sortBy?: OrderByColumnType;
  sortDirection?: OrderByDirectionType;
  offset?: number;
  limit?: number;
};

export type CaseSearchCriteria = {
  phoneNumber?: string;
  contactNumber?: string;
  firstName?: string;
  lastName?: string;
};

export const enum DateExistsCondition {
  MUST_EXIST = 'MUST_EXIST',
  MUST_NOT_EXIST = 'MUST_NOT_EXIST',
}

export type DateFilter = {
  from?: string;
  to?: string;
  exists?: DateExistsCondition;
};

export type CategoryFilter = {
  category: string;
  subcategory: string;
};

export type CaseListFilters = {
  counsellors?: string[];
  statuses?: string[];
  excludedStatuses?: string[];
  createdAt?: DateFilter;
  updatedAt?: DateFilter;
  followUpDate?: DateFilter;
  categories?: CategoryFilter[];
  helplines?: string[];
  includeOrphans?: boolean;
};

export const create = async (
  body: Partial<NewCaseRecord>,
  accountSid: string,
): Promise<CaseRecord> => {
  const { caseSections, ...caseRecord } = body;
  caseRecord.accountSid = accountSid;

  return db.task(async connection => {
    return connection.tx(async transaction => {
      const statement = `${pgp.helpers.insert(caseRecord, null, 'Cases')} RETURNING *`;
      let inserted: CaseRecord = await transaction.one(statement);
      if ((caseSections ?? []).length) {
        const allSections = caseSections.map(s => ({ ...s, caseId: inserted.id, accountSid }));
        const sectionStatement = `${caseSectionUpsertSql(allSections)};${selectSingleCaseByIdSql(
          'Cases',
        )}`;
        const queryValues = { accountSid, caseId: inserted.id };
        inserted = await transaction.one(sectionStatement, queryValues);
      }

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

export const search = async (
  listConfiguration: CaseListConfiguration,
  accountSid: string,
  searchCriteria: CaseSearchCriteria = {},
  filters: CaseListFilters = {},
): Promise<{ cases: readonly CaseRecord[]; count: number }> => {
  const { limit, offset, sortBy, sortDirection } = getPaginationElements(listConfiguration);
  const orderClause = [{ sortBy, sortDirection }];
  const { count, rows } = await db.task(async connection => {
    const statement = selectCaseSearch(filters, orderClause);
    const queryValues = {
      accountSid,
      firstName: searchCriteria.firstName ? `%${searchCriteria.firstName}%` : null,
      lastName: searchCriteria.lastName ? `%${searchCriteria.lastName}%` : null,
      phoneNumber: searchCriteria.phoneNumber
        ? `%${searchCriteria.phoneNumber.replace(/[\D]/gi, '')}%`
        : null,
      contactNumber: searchCriteria.contactNumber || null,
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
  caseRecordUpdates: Partial<NewCaseRecord>,
  accountSid: string,
): Promise<CaseRecord> => {
  const result = await db.tx(async transaction => {
    const caseUpdateSqlStatements = [selectSingleCaseByIdSql('Cases')];
    if (caseRecordUpdates.info) {
      const allSections: CaseSectionRecord[] = caseRecordUpdates.caseSections ?? [];
      if (allSections.length) {
        caseUpdateSqlStatements.push(
          caseSectionUpsertSql(allSections.map(s => ({ ...s, accountSid }))),
        );
      }
      // Map case sections into a list of ids grouped by category, which allows a more concise DELETE SQL statement to be generated
      const caseSectionIdsByType = allSections.reduce((idsBySectionType, caseSection) => {
        idsBySectionType[caseSection.sectionType] = idsBySectionType[caseSection.sectionType] ?? [];
        idsBySectionType[caseSection.sectionType].push(caseSection.sectionId);
        return idsBySectionType;
      }, <Record<string, string[]>>{});
      caseUpdateSqlStatements.push(deleteMissingCaseSectionsSql(caseSectionIdsByType));
    }
    caseUpdateSqlStatements.push(updateByIdSql(caseRecordUpdates));
    caseUpdateSqlStatements.push(selectSingleCaseByIdSql('Cases'));

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [original, ...restOfOutput] = await transaction.multi<CaseRecord>(
      caseUpdateSqlStatements.join(`;
    `),
      {
        accountSid,
        caseId: id,
      },
    );
    const updated = restOfOutput.pop();

    return updated;
  });
  return result.length ? result[0] : void 0;
};

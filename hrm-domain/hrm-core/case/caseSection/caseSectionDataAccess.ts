/**
 * Copyright (C) 2021-2023 Technology Matters
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see https://www.gnu.org/licenses/.
 */

import { db, pgp } from '../../connection-pool';
import { CaseSectionRecord, CaseSectionUpdate } from './types';
import { SELECT_CASE_SECTION_BY_ID } from './sql/readSql';
import { DELETE_CASE_SECTION_BY_ID } from './sql/deleteSql';
import { UPDATE_CASE_SECTION_BY_ID } from './sql/updateSql';

export const create = async (
  sectionRecord: CaseSectionRecord,
): Promise<CaseSectionRecord> => {
  return db.task(async connection =>
    connection.oneOrNone(
      `${pgp.helpers.insert(
        sectionRecord,
        [
          'caseId',
          'sectionType',
          'sectionId',
          'createdBy',
          'createdAt',
          'sectionTypeSpecificData',
          'accountSid',
        ],
        'CaseSections',
      )} RETURNING *`,
    ),
  );
};

export const getById = async (
  accountSid: string,
  caseId: number,
  sectionType,
  sectionId,
): Promise<CaseSectionRecord | undefined> => {
  return db.task(async connection => {
    const queryValues = { accountSid, caseId, sectionType, sectionId };
    return connection.oneOrNone(SELECT_CASE_SECTION_BY_ID, queryValues);
  });
};

export const deleteById = async (
  accountSid: string,
  caseId: number,
  sectionType,
  sectionId,
): Promise<CaseSectionRecord | undefined> => {
  return db.oneOrNone(DELETE_CASE_SECTION_BY_ID, {
    accountSid,
    caseId,
    sectionType,
    sectionId,
  });
};

export const updateById = async (
  accountSid: string,
  caseId: number,
  sectionType: string,
  sectionId: string,
  updates: CaseSectionUpdate,
): Promise<CaseSectionRecord> => {
  return db.task(async connection => {
    const statementValues = {
      accountSid,
      caseId,
      sectionType,
      sectionId,
      ...updates,
    };
    return connection.oneOrNone(UPDATE_CASE_SECTION_BY_ID, statementValues);
  });
};

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

/**
 * This is the 'business logic' module for Case CRUD operations.
 * For the moment it just does some light mapping between the types used for the REST layer, and the types used for the database layer.
 * This includes compatibility code required to provide cases in a shape expected by older clients
 */
import { CaseSectionRecord } from './types';
import { randomUUID } from 'crypto';
import { CaseSection, CaseSectionUpdate, NewCaseSection } from './types';
import { AccountSID } from '@tech-matters/types';
import { create, deleteById, getById, updateById } from './caseSectionDataAccess';

const sectionRecordToSection = (
  sectionRecord: CaseSectionRecord | undefined,
): CaseSection | undefined => {
  if (!sectionRecord) {
    return undefined;
  }
  const { accountSid, caseId, sectionType, ...section } = sectionRecord;
  return section;
};

export const createCaseSection = async (
  accountSid: AccountSID,
  caseId: string,
  sectionType: string,
  newSection: NewCaseSection,
  workerSid: string,
): Promise<CaseSection> => {
  const nowISO = new Date().toISOString();
  const record: CaseSectionRecord = {
    sectionId: randomUUID(),
    ...newSection,
    caseId: Number.parseInt(caseId),
    sectionType,
    createdBy: workerSid,
    createdAt: nowISO,
    accountSid,
  };
  return sectionRecordToSection(await create(record));
};

export const replaceCaseSection = async (
  accountSid: AccountSID,
  caseId: string,
  sectionType: string,
  sectionId: string,
  newSection: NewCaseSection,
  workerSid: string,
): Promise<CaseSection> => {
  const nowISO = new Date().toISOString();

  const record: CaseSectionUpdate = {
    ...newSection,
    updatedBy: workerSid,
    updatedAt: nowISO,
  };
  return sectionRecordToSection(
    await updateById(accountSid, Number.parseInt(caseId), sectionType, sectionId, record),
  );
};

export const getCaseSection = async (
  accountSid: string,
  caseId: string,
  sectionType: string,
  sectionId: string,
): Promise<CaseSection | undefined> => {
  return sectionRecordToSection(
    await getById(accountSid, Number.parseInt(caseId), sectionType, sectionId),
  );
};

export const deleteCaseSection = async (
  accountSid: AccountSID,
  caseId: string,
  sectionType: string,
  sectionId: string,
): Promise<CaseSection | undefined> => {
  return sectionRecordToSection(
    await deleteById(accountSid, Number.parseInt(caseId), sectionType, sectionId),
  );
};

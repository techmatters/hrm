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
 * This is the 'business logic' module for Case Section CRUD operations.
 */
import { randomUUID } from 'crypto';
import {
  CaseSection,
  CaseSectionUpdate,
  NewCaseSection,
  CaseSectionRecord,
} from './types';
import {
  create,
  deleteById,
  getById,
  getTimeline,
  TimelineResult,
  updateById,
} from './caseSectionDataAccess';
import { TwilioUser } from '@tech-matters/twilio-worker-auth';
import { RulesFile, TKConditionsSets } from '../../permissions/rulesMap';
import { ListConfiguration } from '../caseDataAccess';
import { HrmAccountId } from '@tech-matters/types';

const sectionRecordToSection = (
  sectionRecord: CaseSectionRecord | undefined,
): CaseSection | undefined => {
  if (!sectionRecord) {
    return undefined;
  }
  const { accountSid, caseId, ...section } = sectionRecord;
  return section;
};

export const createCaseSection = async (
  accountSid: HrmAccountId,
  caseId: string,
  sectionType: string,
  newSection: NewCaseSection,
  workerSid: string,
): Promise<CaseSection> => {
  const nowISO = new Date().toISOString();
  const record: CaseSectionRecord = {
    sectionId: randomUUID(),
    eventTimestamp: nowISO,
    ...newSection,
    caseId: Number.parseInt(caseId),
    sectionType,
    createdBy: workerSid,
    createdAt: nowISO,
    accountSid,
  };
  return sectionRecordToSection(await create()(record));
};

export const replaceCaseSection = async (
  accountSid: HrmAccountId,
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
    await updateById()(
      accountSid,
      Number.parseInt(caseId),
      sectionType,
      sectionId,
      record,
    ),
  );
};

export const getCaseSection = async (
  accountSid: HrmAccountId,
  caseId: string,
  sectionType: string,
  sectionId: string,
): Promise<CaseSection | undefined> => {
  return sectionRecordToSection(
    await getById(accountSid, Number.parseInt(caseId), sectionType, sectionId),
  );
};

export const getCaseTimeline = async (
  accountSid: HrmAccountId,
  {
    user,
    permissions,
  }: {
    user: TwilioUser;
    permissions: RulesFile;
  },
  caseId: number,
  sectionTypes: string[],
  includeContacts: boolean,
  { limit, offset }: ListConfiguration,
): Promise<TimelineResult> => {
  return getTimeline(
    accountSid,
    user,
    permissions.viewContact as TKConditionsSets<'contact'>,
    caseId,
    sectionTypes,
    includeContacts,
    parseInt(limit),
    parseInt(offset),
  );
};

export const getCaseSectionTypeList = async (
  accountSid: HrmAccountId,

  req: {
    user: TwilioUser;
    permissions: RulesFile;
  },
  caseId: number,
  sectionType: string,
): Promise<CaseSection[]> =>
  (
    await getCaseTimeline(accountSid, req, caseId, [sectionType], false, {
      limit: '1000',
      offset: '0',
    })
  ).activities.map(event => sectionRecordToSection(event.activity));

export const deleteCaseSection = async (
  accountSid: HrmAccountId,
  caseId: string,
  sectionType: string,
  sectionId: string,
  { user }: { user: TwilioUser },
): Promise<CaseSection | undefined> => {
  return sectionRecordToSection(
    await deleteById()(
      accountSid,
      Number.parseInt(caseId),
      sectionType,
      sectionId,
      user.workerSid,
    ),
  );
};

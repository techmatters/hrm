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
import { TimelineActivity, TimelineApiResponse } from '@tech-matters/hrm-types';
import {
  CaseSection,
  CaseSectionUpdate,
  NewCaseSection,
  CaseSectionRecord,
  isContactRecordTimelineActivity,
} from './types';
import {
  create,
  deleteById,
  getById,
  getTimeline,
  updateById,
} from './caseSectionDataAccess';
import { TwilioUser } from '@tech-matters/twilio-worker-auth';
import { RulesFile, TKConditionsSets } from '../../permissions/rulesMap';
import { ListConfiguration } from '../caseDataAccess';
import { ErrorResult, HrmAccountId, isErr, newOkFromData } from '@tech-matters/types';
import { updateCaseNotify } from '../caseService';
import {
  DatabaseErrorResult,
  isDatabaseUniqueConstraintViolationErrorResult,
  isDatabaseForeignKeyViolationErrorResult,
} from '../../sql';
import { SuccessResult } from '@tech-matters/types';
import { contactRecordToContact } from '../../contact/contactService';

type ResourceAlreadyExists = 'ResourceAlreadyExists';
type ForeignKeyViolation = 'ForeignKeyViolation';
type DBErrorResult = ErrorResult<ResourceAlreadyExists | ForeignKeyViolation> & {
  cause: DatabaseErrorResult;
  resourceIdentifier: string;
  resourceType: 'caseSection';
};

const newDBErrorResult = ({
  cause,
  error,
  resourceIdentifier,
}: {
  resourceIdentifier: string;
  cause: DatabaseErrorResult;
  error: ResourceAlreadyExists | ForeignKeyViolation;
}) => {
  const message = `caseSection resource already exists: ${resourceIdentifier}`;
  return {
    _tag: 'Result',
    status: 'error',
    error,
    cause,
    resourceIdentifier,
    resourceType: 'caseSection',
    message,
    unwrap: () => {
      throw new Error(message);
    },
  } as const;
};

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
  skipSearchIndex = false,
): Promise<DBErrorResult | DatabaseErrorResult | SuccessResult<CaseSection>> => {
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
  const createdResult = await create()(record);
  if (isErr(createdResult)) {
    if (createdResult.table === 'CaseSections') {
      const resourceIdentifier = `${caseId}/${sectionType}/${record.sectionId}`;
      const cause = createdResult;
      if (isDatabaseUniqueConstraintViolationErrorResult(createdResult)) {
        return newDBErrorResult({
          resourceIdentifier,
          cause,
          error: 'ResourceAlreadyExists',
        });
      }
      if (isDatabaseForeignKeyViolationErrorResult(createdResult)) {
        return newDBErrorResult({
          resourceIdentifier,
          cause,
          error: 'ForeignKeyViolation',
        });
      }
    }
    return createdResult;
  }

  if (!skipSearchIndex) {
    // trigger index operation but don't await for it
    updateCaseNotify({ accountSid, caseId });
  }

  return newOkFromData(sectionRecordToSection(createdResult.unwrap()));
};

export const replaceCaseSection = async (
  accountSid: HrmAccountId,
  caseId: string,
  sectionType: string,
  sectionId: string,
  newSection: NewCaseSection,
  workerSid: string,
  skipSearchIndex = false,
): Promise<CaseSection> => {
  const nowISO = new Date().toISOString();

  const record: CaseSectionUpdate = {
    ...newSection,
    updatedBy: workerSid,
    updatedAt: nowISO,
  };

  const updated = await updateById()(
    accountSid,
    Number.parseInt(caseId),
    sectionType,
    sectionId,
    record,
  );

  if (!skipSearchIndex) {
    // trigger index operation but don't await for it
    updateCaseNotify({ accountSid, caseId });
  }

  return sectionRecordToSection(updated);
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
    permissionRules,
  }: {
    user: TwilioUser;
    permissionRules: RulesFile;
  },
  caseId: string,
  sectionTypes: string[],
  includeContacts: boolean,
  { limit, offset }: ListConfiguration,
): Promise<TimelineApiResponse> => {
  const dbResult = await getTimeline(
    accountSid,
    user,
    permissionRules.viewContact as TKConditionsSets<'contact'>,
    [caseId],
    sectionTypes,
    includeContacts,
    parseInt(limit),
    parseInt(offset),
  );
  return {
    ...dbResult,
    activities: dbResult.activities.map(({ caseId: _, ...event }) => {
      if (isContactRecordTimelineActivity(event)) {
        return {
          ...event,
          activity: contactRecordToContact(event.activity),
        };
      } else {
        return {
          ...event,
          activity: sectionRecordToSection(event.activity),
        };
      }
    }),
  };
};

type MultipleCaseTimelinesResponse = {
  timelines: Record<string, TimelineActivity<any>[]>;
  count: number;
};

export const getMultipleCaseTimelines = async (
  accountSid: HrmAccountId,
  {
    user,
    permissionRules,
  }: {
    user: TwilioUser;
    permissionRules: RulesFile;
  },
  caseIds: string[],
  sectionTypes: string[],
  includeContacts: boolean,
  { limit, offset }: ListConfiguration,
): Promise<MultipleCaseTimelinesResponse> => {
  const dbResult = await getTimeline(
    accountSid,
    user,
    permissionRules.viewContact as TKConditionsSets<'contact'>,
    caseIds,
    sectionTypes,
    includeContacts,
    parseInt(limit),
    parseInt(offset),
  );
  const timelines: Record<string, TimelineActivity<any>[]> = {};
  for (const { caseId, ...activityEntry } of dbResult.activities) {
    timelines[caseId] = timelines[caseId] || [];
    if (isContactRecordTimelineActivity(activityEntry)) {
      timelines[caseId].push({
        ...activityEntry,
        activity: contactRecordToContact(activityEntry.activity),
      });
    } else {
      timelines[caseId].push(activityEntry);
    }
  }
  return {
    count: dbResult.count,
    timelines,
  };
};

export const getCaseSectionTypeList = async (
  accountSid: HrmAccountId,

  req: {
    user: TwilioUser;
    permissionRules: RulesFile;
  },
  caseId: string,
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
  skipSearchIndex = false,
): Promise<CaseSection | undefined> => {
  const deleted = await deleteById()(
    accountSid,
    Number.parseInt(caseId),
    sectionType,
    sectionId,
    user.workerSid,
  );

  if (!skipSearchIndex) {
    // trigger index operation but don't await for it
    updateCaseNotify({ accountSid, caseId });
  }

  return sectionRecordToSection(deleted);
};

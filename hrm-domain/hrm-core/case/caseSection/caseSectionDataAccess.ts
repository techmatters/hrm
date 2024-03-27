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
import { SELECT_CASE_SECTION_BY_ID, selectCaseTimelineSql } from './sql/readSql';
import { DELETE_CASE_SECTION_BY_ID } from './sql/deleteSql';
import { UPDATE_CASE_SECTION_BY_ID } from './sql/updateSql';
import { TwilioUser } from '@tech-matters/twilio-worker-auth';
import { TKConditionsSets } from '../../permissions/rulesMap';
import { isOk } from '@tech-matters/types';
import { Contact } from '../../contact/contactDataAccess';
import { txIfNotInOne } from '../../sql';
import { TOUCH_CASE_SQL } from '../sql/caseUpdateSql';

export type TimelineActivity<T> = {
  timestamp: string;
  activity: T;
  activityType: string;
};

export type ContactTimelineActivity = TimelineActivity<Contact> & {
  activityType: 'contact';
};
export type CaseSectionTimelineActivity = TimelineActivity<CaseSectionRecord> & {
  activityType: 'case-section';
};

export const isCaseSectionTimelineActivity = (
  activity: TimelineActivity<any>,
): activity is CaseSectionTimelineActivity => activity.activityType === 'case-section';

export const create =
  (task?) =>
  async (sectionRecord: CaseSectionRecord): Promise<CaseSectionRecord> => {
    const insertSectionStatement = `${pgp.helpers.insert(
      sectionRecord,
      [
        'caseId',
        'sectionType',
        'sectionId',
        'createdBy',
        'createdAt',
        'sectionTypeSpecificData',
        'accountSid',
        'eventTimestamp',
      ],
      'CaseSections',
    )} RETURNING *`;

    return txIfNotInOne(task, async connection => {
      const [[createdSection]]: CaseSectionRecord[][] =
        await connection.multi<CaseSectionRecord>(
          [insertSectionStatement, TOUCH_CASE_SQL].join(';\n'),
          {
            accountSid: sectionRecord.accountSid,
            caseId: sectionRecord.caseId,
            updatedBy: sectionRecord.createdBy,
          },
        );

      return createdSection;
    });
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

export const deleteById =
  (task?) =>
  async (
    accountSid: string,
    caseId: number,
    sectionType: CaseSectionRecord['sectionType'],
    sectionId: CaseSectionRecord['sectionId'],
    updatedBy: TwilioUser['workerSid'],
  ): Promise<CaseSectionRecord | undefined> => {
    return txIfNotInOne(task, async connection => {
      const [[deletedSection]]: CaseSectionRecord[][] =
        await connection.multi<CaseSectionRecord>(
          [DELETE_CASE_SECTION_BY_ID, TOUCH_CASE_SQL].join(';\n'),
          {
            accountSid,
            caseId,
            sectionType,
            sectionId,
            updatedBy,
          },
        );

      return deletedSection;
    });
  };

export const updateById =
  (task?) =>
  async (
    accountSid: string,
    caseId: number,
    sectionType: string,
    sectionId: string,
    updates: CaseSectionUpdate,
  ): Promise<CaseSectionRecord> => {
    const statementValues = {
      accountSid,
      caseId,
      sectionType,
      sectionId,
      eventTimestamp: null,
      ...updates,
    };

    return txIfNotInOne(task, async connection => {
      const [[updatedSection]]: CaseSectionRecord[][] =
        await connection.multi<CaseSectionRecord>(
          [UPDATE_CASE_SECTION_BY_ID, TOUCH_CASE_SQL].join(';\n'),
          statementValues,
        );

      return updatedSection;
    });
  };

export type TimelineResult = { count: number; activities: TimelineActivity<any>[] };

export const getTimeline = async (
  accountSid: string,
  twilioUser: TwilioUser,
  viewContactsPermissions: TKConditionsSets<'contact'>,
  caseId: number,
  sectionTypes: string[],
  includeContacts: boolean,
  limit: number,
  offset: number,
): Promise<TimelineResult> => {
  const sqlRes = selectCaseTimelineSql(
    twilioUser,
    viewContactsPermissions,
    Boolean(sectionTypes.length),
    includeContacts,
  );
  if (isOk(sqlRes)) {
    const activitiesWithCounts = await db.manyOrNone(sqlRes.data, {
      limit,
      offset,
      caseId,
      accountSid,
      twilioWorkerSid: twilioUser.workerSid,
      sectionTypes,
    });
    const count = activitiesWithCounts.length ? activitiesWithCounts[0].totalCount : 0;
    const activities = activitiesWithCounts.map(ewc => {
      const { totalCount, ...activityWithoutCount } = ewc;
      return activityWithoutCount;
    });
    return {
      count,
      activities,
    };
  } else {
    console.warn(
      `Received request for timeline of case ${caseId} but neither contacts or any case sections were requested, returning empty set`,
    );
    return { count: 0, activities: [] };
  }
};

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
import {
  CaseSection,
  CaseSectionRecord,
  CaseSectionTimelineActivity,
  ContactTimelineActivity,
  TimelineActivity,
} from '@tech-matters/hrm-types';

import { ContactRecord } from '../../contact/contactDataAccess';

export { CaseSectionRecord, CaseSection };

export type CaseSectionUpdate = Omit<
  CaseSection,
  'sectionId' | 'createdBy' | 'createdAt' | 'eventTimestamp' | 'sectionType'
> & {
  eventTimestamp?: string;
};
export type NewCaseSection = Omit<CaseSectionUpdate, 'updatedAt' | 'updatedBy'> & {
  sectionId?: string;
};

export type TimelineActivityRecord = TimelineActivity<any> & { caseId: string };

export type TimelineDbRecords = {
  count: number;
  activities: TimelineActivityRecord[];
};
export const isCaseSectionTimelineActivity = (
  activity: TimelineActivity<any>,
): activity is CaseSectionTimelineActivity => activity.activityType === 'case-section';

export const isContactTimelineActivity = (
  activity: TimelineActivity<any>,
): activity is ContactTimelineActivity =>
  activity.activityType === 'contact' && typeof activity.activity.id === 'string';

export const isContactRecordTimelineActivity = (
  activity: TimelineActivity<any>,
): activity is TimelineActivity<ContactRecord> =>
  activity.activityType === 'contact' && typeof activity.activity.id === 'number';

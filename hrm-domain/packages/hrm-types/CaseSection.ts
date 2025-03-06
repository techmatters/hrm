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

import { HrmAccountId } from '@tech-matters/types';
import { Contact } from './Contact';

export type CaseSectionRecord = {
  caseId: number;
  sectionType: string;
  sectionId: string;
  sectionTypeSpecificData: Record<string, any>;
  accountSid: HrmAccountId;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  updatedBy?: string;
  eventTimestamp: string;
};

export type CaseSection = Omit<CaseSectionRecord, 'accountSid' | 'caseId'>;

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

export type TimelineResult = { count: number; activities: TimelineActivity<any>[] };

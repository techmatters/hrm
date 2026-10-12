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
  isCaseSectionTimelineActivity,
  isContactTimelineActivity,
} from './types';
import { TimelineActivity, Contact } from '@tech-matters/hrm-types';

export const timelineToLegacySections = (
  timeline: TimelineActivity<any>[],
): Record<string, CaseSection[]> => {
  const sections: Record<string, CaseSection[]> = {};
  for (const { activity } of timeline.filter(isCaseSectionTimelineActivity)) {
    sections[activity.sectionType] = sections[activity.sectionType] ?? [];
    const { accountSid, caseId, ...section } = activity;
    sections[activity.sectionType].push(section);
  }

  return sections;
};

export const timelineToLegacyConnectedContacts = (
  timeline: TimelineActivity<any>[],
): Contact[] =>
  timeline.filter(isContactTimelineActivity).map(contact => contact.activity);

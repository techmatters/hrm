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

import format from 'date-fns/format';
import formatISO from 'date-fns/formatISO';
import { putS3Object } from '@tech-matters/s3-client';
import * as caseApi from '@tech-matters/hrm-core/case/caseService';
import { autoPaginate } from '@tech-matters/hrm-core/autoPaginate';

import { getContext, maxPermissions } from './context';
import { parseISO } from 'date-fns';
import {
  isCaseSectionTimelineActivity,
  isContactTimelineActivity,
} from '@tech-matters/hrm-core/case/caseSection/types';
import { getTimelinesForCases } from '@tech-matters/hrm-core/case/caseService';

const getSearchParams = (startDate: Date, endDate: Date) => ({
  filters: {
    updatedAt: {
      from: formatISO(startDate),
      to: formatISO(endDate),
    },
  },
});

export const pullCases = async (startDate: Date, endDate: Date) => {
  const { accountSid, bucket, hrmEnv, shortCode } = await getContext();

  const { filters } = getSearchParams(startDate, endDate);

  const cases = await autoPaginate<caseApi.CaseService>(async ({ limit, offset }) => {
    const caseResult = await caseApi.searchCases(
      accountSid,
      { limit: limit.toString(), offset: offset.toString() },
      {},
      { filters },
      maxPermissions,
    );
    return {
      records: caseResult.cases as caseApi.CaseService[],
      count: caseResult.count,
    };
  });

  const casesWithContactIdOnly = (
    await getTimelinesForCases(accountSid, maxPermissions, cases)
  ).map(({ case: c, timeline }) => {
    const sections: caseApi.CaseService['sections'] = {};
    const connectedContacts: string[] = [];
    for (const item of timeline) {
      if (isCaseSectionTimelineActivity(item)) {
        sections[item.activity.sectionType] = sections[item.activity.sectionType] ?? [];
        sections[item.activity.sectionType].push(item.activity);
      } else if (isContactTimelineActivity(item)) {
        connectedContacts.push(item.activity.id.toString());
      } else
        console.warn(
          `Unknown timeline activity type: ${item.activity.type}, caseId: ${c.id}`,
        );
    }
    return {
      ...c,
      sections,
      connectedContacts,
    };
  });

  const uploadPromises = casesWithContactIdOnly.map(cas => {
    /*
      Case type is slightly wrong. The instance object actually has:
      1) 'totalCount' property, which I think is wrong, so I'm deleting it
    */
    delete (cas as any).totalCount;
    const date = format(parseISO(cas.updatedAt), 'yyyy/MM/dd');
    const key = `hrm-data/${date}/cases/${cas.id}.json`;
    const body = JSON.stringify(cas);
    const params = { bucket, key, body };

    return putS3Object(params);
  });

  try {
    await Promise.all(uploadPromises);
    console.log(
      `>> ${shortCode} ${hrmEnv} ${casesWithContactIdOnly.length} Cases were pulled successfully!`,
    );
  } catch (err) {
    console.error(`>> Error in ${shortCode} ${hrmEnv} Data Pull: Cases`);
    console.error(err);
    // TODO: Should throw an error?
  }
};

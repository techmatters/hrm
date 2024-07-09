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
  GenerateContactQueryParams,
  generateESFilter,
  GenerateQueryParamsObject,
} from '@tech-matters/hrm-search-config';
import {
  ContactSpecificCondition,
  TKCondition,
  UserBasedCondition,
} from '../permissions/rulesMap';
import {
  ConditionWhereClausesES,
  listPermissionWhereClause,
} from '../permissions/queryGenerators/elasticsearchGenerators';
import { TwilioUser } from '@tech-matters/twilio-worker-auth';
import { subDays, subHours } from 'date-fns';

const buildSearchFilters = ({
  counselor,
  dateFrom,
  dateTo,
}: {
  counselor?: string;
  dateFrom?: string;
  dateTo?: string;
}): GenerateContactQueryParams[] => {
  const searchFilters: GenerateContactQueryParams[] = [
    counselor &&
      ({
        documentType: 'contact',
        field: 'twilioWorkerId',
        type: 'term',
        term: counselor,
      } as const),
    (dateFrom || dateTo) &&
      ({
        documentType: 'contact',
        field: 'timeOfContact',
        type: 'range',
        ranges: {
          ...(dateFrom && { lte: new Date(dateFrom).toISOString() }),
          ...(dateTo && { gte: new Date(dateTo).toISOString() }),
        },
      } as const),
  ].filter(Boolean);

  return searchFilters;
};

export const generateContactSearchFilters = (p: {
  counselor?: string;
  dateFrom?: string;
  dateTo?: string;
}) => buildSearchFilters(p).map(generateESFilter);

export type ContactListCondition = Extract<
  TKCondition<'contact'>,
  ContactSpecificCondition | UserBasedCondition
>;

const conditionWhereClauses = ({
  buildParams: { parentPath },
  user,
  queryWrapper,
}: {
  user: TwilioUser;
  buildParams: { parentPath: string };
  // function that modifies the "term" queries in the filters, to wrap them in nested queries if needed
  queryWrapper: (p: GenerateQueryParamsObject) => GenerateQueryParamsObject;
}): ConditionWhereClausesES<'contact'> => ({
  isOwner: generateESFilter(
    queryWrapper({
      documentType: 'contact',
      field: 'twilioWorkerId',
      parentPath,
      type: 'term',
      term: user.workerSid,
    }),
  ),

  timeBasedCondition: ({ createdDaysAgo, createdHoursAgo }) => {
    const now = new Date();
    const timeClauses = [];
    if (typeof createdHoursAgo === 'number') {
      timeClauses.push(subHours(now, createdHoursAgo));
    }

    if (typeof createdDaysAgo === 'number') {
      timeClauses.push(subDays(now, createdDaysAgo));
    }

    // get the "max" date filter - i.e. the most aggressive one (if more than one)
    const greater = timeClauses.sort((a, b) => b.getTime() - a.getTime())[0];

    return generateESFilter(
      queryWrapper({
        documentType: 'contact',
        field: 'timeOfContact',
        parentPath,
        type: 'range',
        ranges: {
          gte: greater.toISOString(),
        },
      }),
    );
  },
});

const listContactsPermissionClause = ({
  listConditionSets,
  user,
  buildParams,
  queryWrapper,
}: {
  listConditionSets: ContactListCondition[][];
  user: TwilioUser;
  buildParams: { parentPath: string };
  queryWrapper: (p: GenerateQueryParamsObject) => GenerateQueryParamsObject;
}) => {
  const clauses = listPermissionWhereClause<'contact'>({
    listConditionSets,
    user,
    conditionWhereClauses: conditionWhereClauses({
      user,
      buildParams,
      queryWrapper,
    }),
  });

  return clauses;
};

export const generateContactPermissionsFilters = ({
  viewContact,
  viewTranscript,
  user,
  buildParams,
  queryWrapper = p => p,
}: {
  viewContact: ContactListCondition[][];
  viewTranscript: ContactListCondition[][];
  user: TwilioUser;
  buildParams: { parentPath: string };
  queryWrapper?: (p: GenerateContactQueryParams) => GenerateQueryParamsObject;
}) => ({
  contactFilters: listContactsPermissionClause({
    listConditionSets: viewContact,
    user,
    buildParams,
    queryWrapper,
  }),
  transcriptFilters: listContactsPermissionClause({
    listConditionSets: viewTranscript,
    user,
    buildParams,
    queryWrapper,
  }),
});

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
  GenerateContactFilterParams,
  generateESFilter,
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
}): GenerateContactFilterParams[] => {
  const searchFilters: GenerateContactFilterParams[] = [
    counselor &&
      ({
        field: 'twilioWorkerId',
        type: 'term',
        term: counselor,
      } as const),
    (dateFrom || dateTo) &&
      ({
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

const buildPermissionFilter = (p: GenerateContactFilterParams) => generateESFilter(p);

export type ContactListCondition = Extract<
  TKCondition<'contact'>,
  ContactSpecificCondition | UserBasedCondition
>;

const conditionWhereClauses = (user: TwilioUser): ConditionWhereClausesES<'contact'> => ({
  isOwner: buildPermissionFilter({
    field: 'twilioWorkerId',
    type: 'term',
    term: user.workerSid,
  }),

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

    return buildPermissionFilter({
      field: 'timeOfContact',
      type: 'range',
      ranges: {
        gte: greater.toISOString(),
      },
    });
  },
});

const listContactsPermissionClause = ({
  listConditionSets,
  user,
}: {
  listConditionSets: ContactListCondition[][];
  user: TwilioUser;
}) => {
  const clauses = listPermissionWhereClause<'contact'>({
    listConditionSets,
    user,
    conditionWhereClauses: conditionWhereClauses(user),
  });

  return clauses;
};

export const generateContactPermissionsFilters = ({
  viewContact,
  viewTranscript,
  user,
}: {
  viewContact: ContactListCondition[][];
  viewTranscript: ContactListCondition[][];
  user: TwilioUser;
}) => ({
  contactFilters: listContactsPermissionClause({ listConditionSets: viewContact, user }),
  transcriptFilters: listContactsPermissionClause({
    listConditionSets: viewTranscript,
    user,
  }),
});

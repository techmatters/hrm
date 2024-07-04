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
  GenerateCaseFilterParams,
  generateESFilter,
} from '@tech-matters/hrm-search-config';
import {
  CaseSpecificCondition,
  TKCondition,
  UserBasedCondition,
} from '../permissions/rulesMap';
import {
  ConditionWhereClausesES,
  listPermissionWhereClause,
} from '../permissions/queryGenerators/elasticsearchGenerators';
import { TwilioUser } from '@tech-matters/twilio-worker-auth';
import { subDays, subHours } from 'date-fns';
import {
  generateContactPermissionsFilters,
  type ContactListCondition,
} from '../contact/contactSearchIndex';

const buildSearchFilters = ({
  counselor,
  dateFrom,
  dateTo,
}: {
  counselor?: string;
  dateFrom?: string;
  dateTo?: string;
}): GenerateCaseFilterParams[] => {
  const searchFilters: GenerateCaseFilterParams[] = [
    counselor &&
      ({
        field: 'twilioWorkerId',
        type: 'term',
        term: counselor,
      } as const),
    (dateFrom || dateTo) &&
      ({
        field: 'createdAt',
        type: 'range',
        ranges: {
          ...(dateFrom && { lte: new Date(dateFrom).toISOString() }),
          ...(dateTo && { gte: new Date(dateTo).toISOString() }),
        },
      } as const),
  ].filter(Boolean);

  return searchFilters;
};

export const generateCaseSearchFilters = (p: {
  counselor?: string;
  dateFrom?: string;
  dateTo?: string;
}) => buildSearchFilters(p).map(generateESFilter);

const buildPermissionFilter = (p: GenerateCaseFilterParams) => generateESFilter(p);

export type CaseListCondition = Extract<
  TKCondition<'case'>,
  CaseSpecificCondition | UserBasedCondition
>;

const contactsParentPath = 'contacts.';

const conditionWhereClauses = ({
  user,
}: {
  user: TwilioUser;
}): ConditionWhereClausesES<'case'> => ({
  isCaseOpen: buildPermissionFilter({
    type: 'mustNot',
    innerQuery: { field: 'status', type: 'term', term: 'closed' },
  }),

  isCaseContactOwner: buildPermissionFilter({
    type: 'nested',
    path: 'contacts',
    innerQuery: {
      type: 'term',
      field: 'twilioWorkerId',
      term: user.workerSid,
      parentPath: contactsParentPath,
    },
  }),

  isCreator: buildPermissionFilter({
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
      field: 'createdAt',
      type: 'range',
      ranges: {
        gte: greater.toISOString(),
      },
    });
  },
});

const listCasePermissionClause = ({
  listConditionSets,
  user,
}: {
  listConditionSets: CaseListCondition[][];
  user: TwilioUser;
}) => {
  const clauses = listPermissionWhereClause<'case'>({
    listConditionSets,
    user,
    conditionWhereClauses: conditionWhereClauses({ user }),
  });

  return clauses;
};

export const generateCasePermissionsFilters = ({
  viewContact,
  viewTranscript,
  viewCase,
  user,
}: {
  viewContact: ContactListCondition[][];
  viewTranscript: ContactListCondition[][];
  viewCase: CaseListCondition[][];
  user: TwilioUser;
}) => {
  const { contactFilters, transcriptFilters } = generateContactPermissionsFilters({
    buildParams: { parentPath: contactsParentPath },
    user,
    viewContact,
    viewTranscript,
  });

  const caseFilters = listCasePermissionClause({ listConditionSets: viewCase, user });

  return { contactFilters, transcriptFilters, caseFilters };
};

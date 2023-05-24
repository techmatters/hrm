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

import startOfDay from 'date-fns/startOfDay';
import endOfDay from 'date-fns/endOfDay';
import subHours from 'date-fns/subHours';
import parse from 'date-fns/parse';
import isValid from 'date-fns/isValid';

import { pullCases } from './pull-cases';
import { pullContacts } from './pull-contacts';
import { pullReferrals } from './pull-referrals';

const hasNoDateArgs = (args: any) =>
  args['start-date'] === undefined && args['end-date'] === undefined;

const getDateRangeForPast12Hours = () => {
  const endDate = new Date();
  const startDate = subHours(endDate, 12);

  return { startDate, endDate };
};

const getDateRangeFromArgs = (args: any) => {
  const startDateFromArgs = args['start-date'];
  const endDateFromArgs = args['end-date'];

  // Question: Should we deal with timezones explicitally?
  const givenStartDate = parse(startDateFromArgs, 'yyyy-MM-dd', new Date());
  const givenEndDate = parse(endDateFromArgs, 'yyyy-MM-dd', new Date());

  if (isValid(givenStartDate) && isValid(givenEndDate)) {
    const startDate = startOfDay(givenStartDate);
    const endDate = endOfDay(givenEndDate);

    return { startDate, endDate };
  } else {
    // Question: Can throwing errors on ECS Tasks cause any issue?
    throw new Error('Invalid start-date or end-date');
  }
};

/**
 * This function will pull the data given start-date and end-date.
 * It will set:
 *  - startDate: startOfDay(start-date)
 *  - endDate: endOfDay(end-date)
 * It will throw an error in case one of the given params is invalid.
 *
 * This function can also be called without start-date and end-date.
 * In this scenario, it will pull data for the last 12h.
 */
export const pullData = async (args: any) => {
  const { startDate, endDate } = hasNoDateArgs(args)
    ? getDateRangeForPast12Hours()
    : getDateRangeFromArgs(args);

  await Promise.all([
    pullCases(startDate, endDate),
    pullContacts(startDate, endDate),
    pullReferrals(startDate, endDate),
  ]);
};

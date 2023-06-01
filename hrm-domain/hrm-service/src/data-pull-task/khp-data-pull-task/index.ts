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

import subHours from 'date-fns/subHours';
import parseISO from 'date-fns/parseISO';
import isValid from 'date-fns/isValid';

import { pullCases } from './pull-cases';
import { pullContacts } from './pull-contacts';

const getDateRangeForPast12Hours = () => {
  const endDate = new Date();
  const startDate = subHours(endDate, 12);

  return { startDate, endDate };
};

const getDateRangeFromArgs = (startDateISO?: string, endDateISO?: string) => {
  const startDate = parseISO(startDateISO);
  const endDate = endDateISO ? parseISO(endDateISO) : new Date();

  if (isValid(startDate) && isValid(endDate)) {
    return { startDate, endDate };
  } else {
    throw new Error('Invalid start-date or end-date');
  }
};

/**
 * This function will pull the data given start-date and end-date.
 * - It will default end-date to 'Now', if it's not specified
 * - It will throw an error in case one of the given params is an invalid ISO string.
 *
 * This function can also be called without start-date and end-date.
 * In this scenario, it will pull data for the last 12h.
 */
export const pullData = async (startDateISO?: string, endDateISO?: string) => {
  const hasNoDateArgs = startDateISO === undefined && endDateISO === undefined;

  const { startDate, endDate } = hasNoDateArgs
    ? getDateRangeForPast12Hours()
    : getDateRangeFromArgs(startDateISO, endDateISO);

  await Promise.all([pullCases(startDate, endDate), pullContacts(startDate, endDate)]);
};

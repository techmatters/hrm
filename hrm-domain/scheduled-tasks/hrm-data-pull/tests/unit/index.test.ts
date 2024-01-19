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
import differenceInSeconds from 'date-fns/differenceInSeconds';
import parseISO from 'date-fns/parseISO';

import { pullData } from '../../index';
import * as pullContactsModule from '../../pull-contacts';
import * as pullCasesModule from '../../pull-cases';

jest.mock('../../pull-contacts');
jest.mock('../../pull-cases');

const getParamsFromSpy = (spy: jest.SpyInstance) => ({
  startDate: spy.mock.calls[0][0],
  endDate: spy.mock.calls[0][1],
});

const assertSpyHasBeenCalledWithRouhly = (
  spy: jest.SpyInstance,
  expectedStartDate: Date,
  expectedEndDate: Date,
) => {
  const { startDate, endDate } = getParamsFromSpy(spy);

  const startDateDelta = differenceInSeconds(expectedStartDate, startDate);
  const endDateDelta = differenceInSeconds(expectedEndDate, endDate);

  expect(spy).toBeCalledWith(startDate, endDate);
  expect(startDateDelta).toBeLessThanOrEqual(1);
  expect(endDateDelta).toBeLessThanOrEqual(1);
};

afterEach(() => {
  jest.clearAllMocks();
});

describe('KHP Data Pull - Params', () => {
  test('When no params, it should default to the last 12h', async () => {
    const pullContactsSpy = jest.spyOn(pullContactsModule, 'pullContacts');
    const pullCasesSpy = jest.spyOn(pullCasesModule, 'pullCases');

    const expectedEndDate = new Date();
    const expectedStartDate = subHours(expectedEndDate, 12);

    await Promise.all([
      pullData(undefined, undefined, undefined),
      pullData(null, null, null),
      pullData('', '', ''),
    ]);

    assertSpyHasBeenCalledWithRouhly(pullContactsSpy, expectedStartDate, expectedEndDate);
    assertSpyHasBeenCalledWithRouhly(pullCasesSpy, expectedStartDate, expectedEndDate);
  });

  test('Valid start-date and end-date', async () => {
    const pullContactsSpy = jest.spyOn(pullContactsModule, 'pullContacts');
    const pullCasesSpy = jest.spyOn(pullCasesModule, 'pullCases');

    const startDateISO = '2023-05-01T10:00:00+0000';
    const endDateISO = '2023-05-30T18:00:00+0000';

    await pullData(startDateISO, endDateISO, undefined);

    expect(pullContactsSpy).toHaveBeenCalledWith(
      parseISO(startDateISO),
      parseISO(endDateISO),
    );
    expect(pullCasesSpy).toHaveBeenCalledWith(
      parseISO(startDateISO),
      parseISO(endDateISO),
    );
  });

  test('No end-date should default to now', async () => {
    const pullContactsSpy = jest.spyOn(pullContactsModule, 'pullContacts');
    const pullCasesSpy = jest.spyOn(pullCasesModule, 'pullCases');

    const startDateISO = '2023-05-01T10:00:00+0000';
    const now = new Date();

    await pullData(startDateISO, undefined, undefined);

    assertSpyHasBeenCalledWithRouhly(pullContactsSpy, parseISO(startDateISO), now);
    assertSpyHasBeenCalledWithRouhly(pullCasesSpy, parseISO(startDateISO), now);
  });

  test('Ivalid date should throw', async () => {
    const pullContactsSpy = jest.spyOn(pullContactsModule, 'pullContacts');
    const pullCasesSpy = jest.spyOn(pullCasesModule, 'pullCases');

    const startDateISO = '9999INVALID';

    await expect(pullData(startDateISO, undefined, undefined)).rejects.toThrow();

    expect(pullContactsSpy).not.toHaveBeenCalled();
    expect(pullCasesSpy).not.toHaveBeenCalled();
  });
});

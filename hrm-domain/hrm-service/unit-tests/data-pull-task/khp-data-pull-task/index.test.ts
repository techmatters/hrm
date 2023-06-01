import subHours from 'date-fns/subHours';
import differenceInSeconds from 'date-fns/differenceInSeconds';
import parseISO from 'date-fns/parseISO';

import { pullData } from '../../../src/data-pull-task/khp-data-pull-task';
import * as pullContactsModule from '../../../src/data-pull-task/khp-data-pull-task/pull-contacts';
import * as pullCasesModule from '../../../src/data-pull-task/khp-data-pull-task/pull-cases';

jest.mock('../../../src/data-pull-task/khp-data-pull-task/pull-contacts');
jest.mock('../../../src/data-pull-task/khp-data-pull-task/pull-cases');

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

    await pullData();

    assertSpyHasBeenCalledWithRouhly(pullContactsSpy, expectedStartDate, expectedEndDate);
    assertSpyHasBeenCalledWithRouhly(pullCasesSpy, expectedStartDate, expectedEndDate);
  });

  test('Valid start-date and end-date', async () => {
    const pullContactsSpy = jest.spyOn(pullContactsModule, 'pullContacts');
    const pullCasesSpy = jest.spyOn(pullCasesModule, 'pullCases');

    const startDateISO = '2023-05-01T10:00:00+0000';
    const endDateISO = '2023-05-30T18:00:00+0000';

    await pullData(startDateISO, endDateISO);

    expect(pullContactsSpy).toHaveBeenCalledWith(parseISO(startDateISO), parseISO(endDateISO));
    expect(pullCasesSpy).toHaveBeenCalledWith(parseISO(startDateISO), parseISO(endDateISO));
  });

  test('No end-date should default to now', async () => {
    const pullContactsSpy = jest.spyOn(pullContactsModule, 'pullContacts');
    const pullCasesSpy = jest.spyOn(pullCasesModule, 'pullCases');

    const startDateISO = '2023-05-01T10:00:00+0000';
    const now = new Date();

    await pullData(startDateISO);

    assertSpyHasBeenCalledWithRouhly(pullContactsSpy, parseISO(startDateISO), now);
    assertSpyHasBeenCalledWithRouhly(pullCasesSpy, parseISO(startDateISO), now);
  });

  test('Ivalid date should throw', async () => {
    const pullContactsSpy = jest.spyOn(pullContactsModule, 'pullContacts');
    const pullCasesSpy = jest.spyOn(pullCasesModule, 'pullCases');

    const startDateISO = '9999INVALID';

    await expect(pullData(startDateISO)).rejects.toThrow();

    expect(pullContactsSpy).not.toHaveBeenCalled();
    expect(pullCasesSpy).not.toHaveBeenCalled();
  });
});

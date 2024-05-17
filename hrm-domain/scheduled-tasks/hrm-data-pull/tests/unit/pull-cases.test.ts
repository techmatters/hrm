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

import parseISO from 'date-fns/parseISO';
import formatISO from 'date-fns/formatISO';
import format from 'date-fns/format';
import addDays from 'date-fns/addDays';

import * as caseApi from '@tech-matters/hrm-core/case/caseService';
import * as context from '../../context';
import { defaultLimitAndOffset } from '../../auto-paginate';
import { pullCases } from '../../pull-cases';
import { HrmAccountId } from '@tech-matters/types';

const { maxPermissions } = context;

const accountSid: HrmAccountId = 'ACxxx';
const bucket = 'docs-bucket';
const hrmEnv = 'test';
const shortCode = 'XX';

jest.mock('@tech-matters/hrm-core/contact/contactService');
jest.mock('../../context');

let putS3ObjectSpy = jest.fn();
jest.mock('@tech-matters/s3-client', () => {
  return {
    putS3Object: (params: any) => {
      putS3ObjectSpy(params);
      return Promise.resolve();
    },
  };
});

const getExpectedS3Params = (cas: caseApi.CaseService) => {
  const date = format(parseISO(cas.updatedAt), 'yyyy/MM/dd');
  return {
    bucket,
    key: `hrm-data/${date}/cases/${cas.id}.json`,
    body: JSON.stringify(cas),
  };
};

beforeEach(() => {
  const getContextResponse = Promise.resolve({
    accountSid,
    bucket,
    hrmEnv,
    shortCode,
  });

  jest.spyOn(context, 'getContext').mockReturnValue(getContextResponse);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('KHP Data Pull - Pull Cases', () => {
  const startDate = parseISO('2023-05-01T00:00:00.000Z');
  const endDate = parseISO('2023-05-30T00:00:00.000Z');

  const filterParams = {
    filters: {
      updatedAt: {
        from: formatISO(startDate),
        to: formatISO(endDate),
      },
    },
  };

  test('should call searchCases with the correct params', async () => {
    const searchCasesResponse = Promise.resolve({
      count: 0,
      cases: [],
    });

    const searchCasesSpy = jest
      .spyOn(caseApi, 'searchCases')
      .mockReturnValue(searchCasesResponse);

    await pullCases(startDate, endDate);

    expect(searchCasesSpy).toHaveBeenCalledWith(
      accountSid,
      defaultLimitAndOffset,
      {},
      filterParams,
      maxPermissions,
    );
  });

  test('should call upload to S3 with the correct params', async () => {
    const case1: caseApi.CaseService = {
      id: 1234,
      categories: {},
      connectedContacts: [],
      info: {},
      sections: {},
      helpline: 'helpline',
      status: 'open',
      twilioWorkerId: 'WKxxx',
      createdBy: 'WKxxx',
      updatedBy: 'WKxxx',
      accountSid,
      createdAt: addDays(startDate, 1).toISOString(),
      updatedAt: addDays(startDate, 1).toISOString(),
      statusUpdatedAt: null,
      statusUpdatedBy: null,
    };

    const case2: caseApi.CaseService = {
      id: 2345,
      categories: {},
      connectedContacts: [],
      info: {},
      sections: {},
      helpline: 'helpline',
      status: 'open',
      twilioWorkerId: 'WKxxx',
      createdBy: 'WKxxx',
      updatedBy: 'WKxxx',
      accountSid,
      createdAt: addDays(startDate, 2).toISOString(),
      updatedAt: addDays(startDate, 2).toISOString(),
      statusUpdatedAt: null,
      statusUpdatedBy: null,
    };

    const searchCasesResponse = {
      count: 2,
      cases: [case1, case2],
    };

    jest.spyOn(caseApi, 'searchCases').mockResolvedValue(searchCasesResponse);

    await pullCases(startDate, endDate);

    expect(putS3ObjectSpy).toHaveBeenCalledWith(getExpectedS3Params(case1));
    expect(putS3ObjectSpy).toHaveBeenCalledWith(getExpectedS3Params(case2));
    expect(putS3ObjectSpy).toBeCalledTimes(2);
  });
});

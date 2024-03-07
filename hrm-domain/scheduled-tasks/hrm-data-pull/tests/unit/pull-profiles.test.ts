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

import addDays from 'date-fns/addDays';
import parseISO from 'date-fns/parseISO';
import formatISO from 'date-fns/formatISO';
import format from 'date-fns/format';

import * as profileApi from '@tech-matters/hrm-core/profile/profileService';
import * as context from '../../context';
import { defaultLimitAndOffset } from '../../auto-paginate';
import { pullProfiles } from '../../pull-profiles';

const { maxPermissions } = context;

jest.mock('@tech-matters/hrm-core/profile/profileService');
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

const bucket = 'docs-bucket';
const accountSid = 'ACxxx';

const getExpectedS3Params = (profile: profileApi.Profile) => {
  const date = format(parseISO(profile.updatedAt), 'yyyy/MM/dd');
  return {
    bucket,
    key: `hrm-data/${date}/profiles/${profile.id}.json`,
    body: JSON.stringify(profile),
  };
};

beforeEach(() => {
  const getContextResponse = Promise.resolve({
    accountSid,
    bucket,
  });

  jest.spyOn(context, 'getContext').mockReturnValue(getContextResponse);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('Data Pull for Profiles', () => {
  const startDate = parseISO('2024-03-01T00:00:00.000Z');
  const endDate = parseISO('2024-03-03T00:00:00.000Z');

  const searchParams = {
    dateFrom: formatISO(startDate),
    dateTo: formatISO(endDate),
  };

  test('should call searchProfiles with the correct params', async () => {
    const searchProfilesResponse = Promise.resolve({
      count: 0,
      profiles: [],
    });

    const searchProfilesSpy = jest
      .spyOn(profileApi, 'searchProfiles')
      .mockReturnValue(searchProfilesResponse);

    await pullProfiles(startDate, endDate);

    expect(searchProfilesSpy).toHaveBeenCalledWith(
      accountSid,
      searchParams,
      {
        offset: parseInt(defaultLimitAndOffset.offset),
        limit: parseInt(defaultLimitAndOffset.limit),
      },
      maxPermissions,
    );
  });

  test('should call upload to S3 with the correct params', async () => {
    const profile1 = {
      id: 1,
      name: null,
      accountSid,
      createdAt: addDays(startDate, 1),
      updatedAt: addDays(startDate, 2),
      createdBy: 'WKxxx',
      updatedBy: 'WKxxx',
      identifiers: [
        {
          id: 101,
          type: 'Email',
          value: 'example1@example.com',
          channel: 'Email',
          createdAt: addDays(startDate, 1),
          updatedAt: addDays(startDate, 2),
          createdBy: 'WKxxx',
          updatedBy: 'WKxxx',
        },
      ],
      profileFlags: [
        {
          id: 201,
          flagType: 'blocked',
          validUntil: addDays(startDate, 5),
          createdAt: addDays(startDate, 1),
          updatedAt: addDays(startDate, 2),
          createdBy: 'WKxxx',
          updatedBy: 'WKxxx',
        },
      ],
      profileSections: [
        {
          sectionType: 'Notes',
          content: 'Initial notes on profile.',
          createdAt: addDays(startDate, 1),
          updatedAt: addDays(startDate, 2),
          createdBy: 'WKxxx',
          updatedBy: 'WKxxx',
        },
      ],
      contactIds: [2, 6, 7],
      caseIds: [1],
    };
    const profile2 = {
      id: 2,
      name: null,
      accountSid,
      createdAt: addDays(startDate, 1),
      updatedAt: addDays(startDate, 2),
      createdBy: 'WKxxx',
      updatedBy: 'WKxxx',
      identifiers: [
        {
          id: 101,
          type: 'Email',
          value: 'example1@example.com',
          channel: 'Email',
          createdAt: addDays(startDate, 1),
          updatedAt: addDays(startDate, 2),
          createdBy: 'WKxxx',
          updatedBy: 'WKxxx',
        },
      ],
      profileFlags: [
        {
          id: 201,
          flagType: 'risk',
          validUntil: null,
          createdAt: addDays(startDate, 1),
          updatedAt: addDays(startDate, 2),
          createdBy: 'WKxxx',
          updatedBy: 'WKxxx',
        },
      ],
      profileSections: [
        {
          sectionType: 'Summary',
          content: 'Initial notes on profile.',
          createdAt: addDays(startDate, 1),
          updatedAt: addDays(startDate, 2),
          createdBy: 'WKxxx',
          updatedBy: 'WKxxx',
        },
      ],
      caseIds: [2, 3],
      contactIds: [3, 4, 5],
    };

    const searchProfilesResponse = Promise.resolve({
      count: 2,
      profiles: [profile1, profile2],
    });

    jest.spyOn(profileApi, 'searchProfiles').mockReturnValue(searchProfilesResponse);

    await pullProfiles(startDate, endDate);
    console.log('>> Profiles were pulled successfully!', putS3ObjectSpy.mock.calls);

    expect(putS3ObjectSpy).toHaveBeenCalledWith(getExpectedS3Params(profile1));
    expect(putS3ObjectSpy).toHaveBeenCalledWith(getExpectedS3Params(profile2));

    expect(putS3ObjectSpy).toBeCalledTimes(2);
  });
});

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

import formatISO from 'date-fns/formatISO';
import { putS3Object } from '@tech-matters/s3-client';
import * as profileApi from '@tech-matters/hrm-core/profile/profileService';

import { getContext, maxPermissions } from './context';
import { autoPaginate } from './auto-paginate';

const getSearchParams = (startDate: Date, endDate: Date) => ({
  filters: {
    updatedAt: {
      from: formatISO(startDate),
      to: formatISO(endDate),
    },
  },
});

// identifiers =
// flags = getProfileFlagsByIdentifier and associate profileFlags with getProfileFlags(accountSid)
// sections = getProfileSectionById
// contactIds = searchContactsByProfileId(profileId)
// caseIds = searchCasesByProfileId(profileId)

export const pullProfiles = async (startDate: Date, endDate: Date) => {
  const { accountSid, bucket } = await getContext();

  const { filters } = getSearchParams(startDate, endDate);

  const profiles = await autoPaginate<profileApi.Profile>(async ({ limit, offset }) => {
    const profileResult = await profileApi.searchProfiles(
      accountSid,
      { limit: limit.toString(), offset: offset.toString() },
      {},
      { filters },
      maxPermissions,
    );
    return {
      records: profileResult.profiles as profileApi.Profile[],
      count: profileResult.count,
    };
  });

  const uploadPromises = profiles.map(profile => {
    const date = profile.createdAt;
    const key = `hrm-data/${date}/profiles/${profile.id}.json`;
    const body = JSON.stringify(profiles);
    const params = { bucket, key, body };

    return putS3Object(params);
  });

  try {
    await Promise.all(uploadPromises);
    console.log('>> Profiles were pulled successfully!');
  } catch (err) {
    console.error('>> Error in Profiles Data Pull');
    console.error(err);
    // TODO: Should throw an error?
  }
};

// {
//   id: number,
//   accountSid: string,
//   createdAt: Date,
//   updatedAt: Date,
//   createdBy: string,
//   updatedBy?: string,
//   identifiers: [
//       {
//           id: number,
//           type: string,
//           value: string,
//           channel: string,
//           createdAt: Date,
//           updatedAt: Date,
//           createdBy: string,
//           updatedBy?: string
//       }
//   ],
//   profileFlags: [
//       {
//           id: number,
//           flagType: string,
//           validUntil: Date | null,
//           createdAt: Date,
//           updatedAt: Date,
//           createdBy: string,
//           updatedBy?: string
//       }
//   ],
//   profileSections: [
//       {
//           sectionType: string,
//           content: string,
//           createdAt: Date,
//           updatedAt: Date,
//           createdBy: string,
//           updatedBy?: string
//       }
//   ],
// contactIds: string[],
// caseIds: string[],
// }

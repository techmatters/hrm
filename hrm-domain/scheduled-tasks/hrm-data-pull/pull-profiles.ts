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

import format from 'date-fns/format';
import formatISO from 'date-fns/formatISO';
import { putS3Object } from '@tech-matters/s3-client';
import * as profileApi from '@tech-matters/hrm-core/profile/profileService';
import { getCasesByProfileId } from '@tech-matters/hrm-core/case/caseService';
import {
  Contact,
  getContactsByProfileId,
} from '@tech-matters/hrm-core/contact/contactService';
import type {
  ProfileFlag,
  ProfileSection,
  ProfileWithRelationships,
} from '@tech-matters/hrm-core/profile/profileDataAccess';

import { getContext, maxPermissions } from './context';
import { autoPaginate } from './auto-paginate';
import { parseISO } from 'date-fns';
import { CaseRecord } from '@tech-matters/hrm-core/case/caseDataAccess';

const getSearchParams = (startDate: Date, endDate: Date) => ({
  filters: {
    updatedAt: {
      from: formatISO(startDate),
      to: formatISO(endDate),
    },
  },
});

const getProfileSectionsForProfile = (p: ProfileWithRelationships) =>
  p.profileSections.reduce<Promise<ProfileSection[]>>(
    async (prevPromise, { id: sectionId }) => {
      const accum = await prevPromise;
      const section = (
        await profileApi.getProfileSectionById(p.accountSid, {
          profileId: p.id,
          sectionId,
        })
      ).unwrap();

      return [...accum, section];
    },
    Promise.resolve([]),
  );

export const pullProfiles = async (startDate: Date, endDate: Date) => {
  const { accountSid, bucket, hrmEnv, shortCode } = await getContext();

  try {
    const { filters } = getSearchParams(startDate, endDate);

    const populatedProfiles = await autoPaginate(async ({ limit, offset }) => {
      const profileFlagsR = await profileApi.getProfileFlags(accountSid);
      const profileFlags = profileFlagsR
        .unwrap()
        .reduce<{ [id: ProfileFlag['id']]: ProfileFlag }>(
          (acc, curr) => ({
            ...acc,
            [curr.id]: curr,
          }),
          {},
        );

      const { count, profiles } = (
        await profileApi.listProfiles(
          accountSid,
          { limit: limit.toString(), offset: offset.toString() },
          { filters },
          // {filters: {profileFlagIds}},
        )
      ).unwrap();

      const profilesWithFlags = profiles.map(p => {
        return {
          ...p,
          // destructuring on pf as it include validUntil
          profileFlags: p.profileFlags.map(pf => ({ ...pf, ...profileFlags[pf.id] })),
        };
      });

      const profilesWithSections = await profilesWithFlags.reduce<
        Promise<
          (Omit<ProfileWithRelationships, 'profileFlags' | 'profileSections'> & {
            profileFlags: ProfileFlag[];
            profileSections: ProfileSection[];
          })[]
        >
      >(async (prevPromise, profile) => {
        const acc = await prevPromise;
        const profileSections = await getProfileSectionsForProfile(profile);
        return [...acc, { ...profile, profileSections }];
      }, Promise.resolve([]));

      const profilesWithContacts = await profilesWithSections.reduce<
        Promise<
          (Omit<ProfileWithRelationships, 'profileFlags' | 'profileSections'> & {
            profileFlags: ProfileFlag[];
            profileSections: ProfileSection[];
            contactIds: Contact['id'][];
          })[]
        >
      >(async (prevPromise, profile) => {
        const acc = await prevPromise;
        const contactIds = await autoPaginate(async ({ limit: l, offset: o }) => {
          const result = await getContactsByProfileId(
            accountSid,
            profile.id,
            { limit: l.toString(), offset: o.toString() },
            maxPermissions,
          );

          const { contacts, count: contactsCount } = result.unwrap();

          return {
            count: contactsCount,
            records: contacts.map(c => c.id),
          };
        });

        return [...acc, { ...profile, contactIds }];
      }, Promise.resolve([]));

      const profilesWithCases = await profilesWithContacts.reduce<
        Promise<
          (Omit<ProfileWithRelationships, 'profileFlags' | 'profileSections'> & {
            profileFlags: ProfileFlag[];
            profileSections: ProfileSection[];
            contactIds: Contact['id'][];
            caseIds: CaseRecord['id'][];
          })[]
        >
      >(async (prevPromise, profile) => {
        const acc = await prevPromise;
        const caseIds = await autoPaginate(async ({ limit: l, offset: o }) => {
          const result = await getCasesByProfileId(
            accountSid,
            profile.id,
            { limit: l.toString(), offset: o.toString() },
            maxPermissions,
          );

          const { cases, count: casesCount } = result.unwrap();

          return {
            count: casesCount,
            records: cases.map(c => c.id),
          };
        });

        return [...acc, { ...profile, caseIds }];
      }, Promise.resolve([]));

      return {
        records: profilesWithCases,
        count: count,
      };
    });

    const uploadPromises = populatedProfiles.map(profile => {
      /*
      Inner type is slightly wrong. The instance object actually has:
      1) 'totalCount' property, which I think is wrong, so I'm deleting it
    */
      delete (profile as any).totalCount;
      const date = format(parseISO(profile.updatedAt.toISOString()), 'yyyy/MM/dd');
      const key = `hrm-data/${date}/profiles/${profile.id}.json`;
      const body = JSON.stringify(profile);
      const params = { bucket, key, body };

      return putS3Object(params);
    });

    await Promise.all(uploadPromises);
    console.log(`>> ${shortCode} ${hrmEnv} Cases were pulled successfully!`);
  } catch (err) {
    console.error(`>> Error in ${shortCode} ${hrmEnv} Data Pull: Cases`);
    console.error(err);
    // TODO: Should throw an error?
  }
};

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

import { cleanupProfileFlags } from '@tech-matters/profile-flags-cleanup';
import { addDays, subDays } from 'date-fns';
import { accountSid, workerSid } from '../mocks';
import * as profileDB from '@tech-matters/hrm-core/profile/profileDataAccess';
import { newTwilioUser, systemUser } from '@tech-matters/twilio-worker-auth';
import { setupServiceTests } from '../setupServiceTest';
import { db } from '../dbConnection';

setupServiceTests();

let createdProfile: profileDB.Profile;
let profileFlags: profileDB.ProfileFlag[];
let createdProfileFlag: profileDB.ProfileFlag;

beforeEach(async () => {
  [createdProfile, createdProfileFlag] = await Promise.all([
    profileDB.createProfile()(accountSid, {
      name: 'TEST_PROFILE',
      createdBy: workerSid,
      definitionVersion: 'as-v1',
    }),
    await profileDB.createProfileFlag(accountSid, {
      name: 'TEST_PROFILE_FLAG',
      createdBy: workerSid,
    }),
  ]);

  profileFlags = await profileDB.getProfileFlagsForAccount(accountSid);
});

afterEach(async () => {
  await db.task(async t => {
    await Promise.all([
      t.none(`DELETE FROM "ProfileFlags" WHERE id = $<id>`, {
        id: createdProfileFlag.id,
      }),
    ]);
  });
});

describe('cleanupProfileFlags', () => {
  test('when associations are null, cleanupProfileFlags does nothing', async () => {
    await Promise.all(
      profileFlags.map(pf =>
        profileDB.associateProfileToProfileFlag()(
          accountSid,
          createdProfile.id,
          pf.id,
          null,
          { user: newTwilioUser(accountSid, workerSid, []) },
        ),
      ),
    );

    let p = await profileDB.getProfileById()(accountSid, createdProfile.id);
    expect(p.profileFlags).toHaveLength(3);

    await cleanupProfileFlags();

    p = await profileDB.getProfileById()(accountSid, createdProfile.id);
    expect(p.profileFlags).toHaveLength(3);
  });

  test('when associations are not expired yet, cleanupProfileFlags does nothing', async () => {
    const futureDate = addDays(new Date(), 1);
    await Promise.all(
      profileFlags.map(pf =>
        profileDB.associateProfileToProfileFlag()(
          accountSid,
          createdProfile.id,
          pf.id,
          futureDate,
          { user: newTwilioUser(accountSid, workerSid, []) },
        ),
      ),
    );

    let p = await profileDB.getProfileById()(accountSid, createdProfile.id);
    expect(p.profileFlags).toHaveLength(3);

    await cleanupProfileFlags();

    p = await profileDB.getProfileById()(accountSid, createdProfile.id);
    expect(p.profileFlags).toHaveLength(3);
  });

  test('when associations are expired, cleanupProfileFlags removes them', async () => {
    const pastDate = subDays(new Date(), 1);
    await Promise.all(
      profileFlags.map(pf =>
        profileDB.associateProfileToProfileFlag()(
          accountSid,
          createdProfile.id,
          pf.id,
          pastDate,
          { user: newTwilioUser(accountSid, workerSid, []) },
        ),
      ),
    );

    let p = await profileDB.getProfileById()(accountSid, createdProfile.id);
    expect(p.profileFlags).toHaveLength(3);
    expect(p.updatedBy).toBe(workerSid);
    const lastUpdated = p.updatedAt;

    await cleanupProfileFlags();

    p = await profileDB.getProfileById()(accountSid, createdProfile.id);

    expect(p.updatedBy).toBe(systemUser);
    expect(new Date(lastUpdated).getTime()).toBeLessThan(new Date(p.updatedAt).getTime());
    expect(p.profileFlags).toHaveLength(0);
  });
});

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
import { db } from '@tech-matters/hrm-core/connection-pool';
import { accountSid, workerSid } from '../mocks';
import * as profileDB from '@tech-matters/hrm-core/profile/profileDataAccess';
import { systemUser } from '@tech-matters/twilio-worker-auth';
import isBefore from 'date-fns/isBefore';
import parseISO from 'date-fns/fp/parseISO';

let createdProfile: profileDB.Profile;
let createdProfileFlag: profileDB.ProfileFlag;
let profileFlags: profileDB.ProfileFlag[];
beforeAll(async () => {
  [createdProfile, createdProfileFlag] = await Promise.all([
    profileDB.createProfile()(accountSid, {
      name: 'TEST_PROFILE',
      createdBy: workerSid,
    }),
    (
      await profileDB.createProfileFlag(accountSid, {
        name: 'TEST_PROFILE_FLAG',
        createdBy: workerSid,
      })
    ).unwrap(),
  ]);

  profileFlags = (await profileDB.getProfileFlagsForAccount(accountSid)).unwrap();
});

afterAll(async () => {
  await db.task(async t => {
    await Promise.all([
      t.none(`DELETE FROM "ProfileFlags" WHERE id = $<id>`, {
        id: createdProfileFlag.id,
      }),
      t.none(`DELETE FROM "Profiles" WHERE id = $<id>`, { id: createdProfile.id }),
    ]);
  });
});

describe('cleanupProfileFlags', () => {
  afterEach(async () => {
    db.task(t =>
      t.none(`UPDATE "Profiles" SET "updatedBy" = null WHERE "id" = $<profileId>;`, {
        profileId: createdProfile.id,
      }),
    );
    const p = await profileDB.getProfileById()(accountSid, createdProfile.id);
    await Promise.all(
      p.profileFlags.map(pf =>
        profileDB.disassociateProfileFromProfileFlag()(accountSid, p.id, pf.id),
      ),
    );
  });

  test('when associations are null, cleanupProfileFlags does nothing', async () => {
    await Promise.all(
      profileFlags.map(pf =>
        profileDB.associateProfileToProfileFlag()(
          accountSid,
          createdProfile.id,
          pf.id,
          null,
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
        ),
      ),
    );

    let p = await profileDB.getProfileById()(accountSid, createdProfile.id);
    expect(p.profileFlags).toHaveLength(3);
    expect(p.updatedBy).toBeNull();
    const lastUpdated = p.updatedAt;

    await cleanupProfileFlags();

    p = await profileDB.getProfileById()(accountSid, createdProfile.id);

    expect(p.updatedBy).toBe(systemUser);
    expect(new Date(lastUpdated).getTime()).toBeLessThan(new Date(p.updatedAt).getTime());
    expect(p.profileFlags).toHaveLength(0);
  });
});

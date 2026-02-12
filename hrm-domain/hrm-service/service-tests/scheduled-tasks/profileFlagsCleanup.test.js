"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const profile_flags_cleanup_1 = require("@tech-matters/profile-flags-cleanup");
const date_fns_1 = require("date-fns");
const mocks_1 = require("../mocks");
const profileDB = __importStar(require("@tech-matters/hrm-core/profile/profileDataAccess"));
const twilio_worker_auth_1 = require("@tech-matters/twilio-worker-auth");
const setupServiceTest_1 = require("../setupServiceTest");
const dbConnection_1 = require("../dbConnection");
(0, setupServiceTest_1.setupServiceTests)();
let createdProfile;
let profileFlags;
let createdProfileFlag;
beforeEach(async () => {
    [createdProfile, createdProfileFlag] = await Promise.all([
        profileDB.createProfile()(mocks_1.accountSid, {
            name: 'TEST_PROFILE',
            createdBy: mocks_1.workerSid,
            definitionVersion: 'as-v1',
        }),
        await profileDB.createProfileFlag(mocks_1.accountSid, {
            name: 'TEST_PROFILE_FLAG',
            createdBy: mocks_1.workerSid,
        }),
    ]);
    profileFlags = await profileDB.getProfileFlagsForAccount(mocks_1.accountSid);
});
afterEach(async () => {
    await dbConnection_1.db.task(async (t) => {
        await Promise.all([
            t.none(`DELETE FROM "ProfileFlags" WHERE id = $<id>`, {
                id: createdProfileFlag.id,
            }),
        ]);
    });
});
describe('cleanupProfileFlags', () => {
    test('when associations are null, cleanupProfileFlags does nothing', async () => {
        await Promise.all(profileFlags.map(pf => profileDB.associateProfileToProfileFlag()(mocks_1.accountSid, createdProfile.id, pf.id, null, { user: (0, twilio_worker_auth_1.newTwilioUser)(mocks_1.accountSid, mocks_1.workerSid, []) })));
        let p = await profileDB.getProfileById()(mocks_1.accountSid, createdProfile.id);
        expect(p.profileFlags).toHaveLength(3);
        await (0, profile_flags_cleanup_1.cleanupProfileFlags)();
        p = await profileDB.getProfileById()(mocks_1.accountSid, createdProfile.id);
        expect(p.profileFlags).toHaveLength(3);
    });
    test('when associations are not expired yet, cleanupProfileFlags does nothing', async () => {
        const futureDate = (0, date_fns_1.addDays)(new Date(), 1);
        await Promise.all(profileFlags.map(pf => profileDB.associateProfileToProfileFlag()(mocks_1.accountSid, createdProfile.id, pf.id, futureDate, { user: (0, twilio_worker_auth_1.newTwilioUser)(mocks_1.accountSid, mocks_1.workerSid, []) })));
        let p = await profileDB.getProfileById()(mocks_1.accountSid, createdProfile.id);
        expect(p.profileFlags).toHaveLength(3);
        await (0, profile_flags_cleanup_1.cleanupProfileFlags)();
        p = await profileDB.getProfileById()(mocks_1.accountSid, createdProfile.id);
        expect(p.profileFlags).toHaveLength(3);
    });
    test('when associations are expired, cleanupProfileFlags removes them', async () => {
        const pastDate = (0, date_fns_1.subDays)(new Date(), 1);
        await Promise.all(profileFlags.map(pf => profileDB.associateProfileToProfileFlag()(mocks_1.accountSid, createdProfile.id, pf.id, pastDate, { user: (0, twilio_worker_auth_1.newTwilioUser)(mocks_1.accountSid, mocks_1.workerSid, []) })));
        let p = await profileDB.getProfileById()(mocks_1.accountSid, createdProfile.id);
        expect(p.profileFlags).toHaveLength(3);
        expect(p.updatedBy).toBe(mocks_1.workerSid);
        const lastUpdated = p.updatedAt;
        await (0, profile_flags_cleanup_1.cleanupProfileFlags)();
        p = await profileDB.getProfileById()(mocks_1.accountSid, createdProfile.id);
        expect(p.updatedBy).toBe(twilio_worker_auth_1.systemUser);
        expect(new Date(lastUpdated).getTime()).toBeLessThan(new Date(p.updatedAt).getTime());
        expect(p.profileFlags).toHaveLength(0);
    });
});

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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jest_each_1 = __importDefault(require("jest-each"));
require("./case/caseValidation");
const dbConnection_1 = require("./dbConnection");
const caseApi = __importStar(require("@tech-matters/hrm-core/case/caseService"));
const contactApi = __importStar(require("@tech-matters/hrm-core/contact/contactService"));
const profilesDB = __importStar(require("@tech-matters/hrm-core/profile/profileDataAccess"));
const server_1 = require("./server");
const mocks = __importStar(require("./mocks"));
const mocks_1 = require("./mocks");
const profileService_1 = require("@tech-matters/hrm-core/profile/profileService");
const twilio_worker_auth_1 = require("@tech-matters/twilio-worker-auth");
const dbCleanup_1 = require("./dbCleanup");
const setupServiceTest_1 = require("./setupServiceTest");
const date_fns_1 = require("date-fns");
const { case1, accountSid, workerSid, contact1 } = mocks;
const definitionVersion = 'as-v1';
// eslint-disable-next-line @typescript-eslint/no-shadow
const deleteFromTableById = (table) => async (id, accountSid) => dbConnection_1.db.task(t => t.none(`
  DELETE FROM "${table}" WHERE "id" = ${id} AND "accountSid" = '${accountSid}'
`));
const { request } = (0, setupServiceTest_1.setupServiceTests)();
describe('/profiles', () => {
    const baseRoute = `/v0/accounts/${accountSid}/profiles`;
    const identifier = 'identifier';
    describe('GET', () => {
        let createdProfiles;
        let existingProfiles;
        const profilesNames = ['Murray', 'Antonella', null];
        let defaultFlags;
        beforeEach(async () => {
            existingProfiles = (await profilesDB.listProfiles(accountSid, {}, {})).profiles;
            createdProfiles = [];
            for (const name of profilesNames) {
                createdProfiles.push(await profilesDB.createProfile()(accountSid, {
                    name,
                    definitionVersion,
                    createdBy: workerSid,
                }));
            }
            defaultFlags = await profilesDB.getProfileFlagsForAccount(accountSid);
            const murray = createdProfiles.find(p => p.name === 'Murray');
            const antonella = createdProfiles.find(p => p.name === 'Antonella');
            await Promise.all([
                profilesDB.associateProfileToProfileFlag()(accountSid, murray.id, defaultFlags[0].id, null, { user: (0, twilio_worker_auth_1.newTwilioUser)(accountSid, workerSid, []) }),
                profilesDB.associateProfileToProfileFlag()(accountSid, antonella.id, defaultFlags[1].id, null, { user: (0, twilio_worker_auth_1.newTwilioUser)(accountSid, workerSid, []) }),
                profilesDB.createProfileSection()(antonella.accountSid, {
                    content: 'some example content',
                    sectionType: 'summary',
                    createdBy: 'WK-worker',
                    profileId: antonella.id,
                }),
            ]);
        });
        afterEach(async () => (0, dbCleanup_1.clearAllTables)());
        (0, jest_each_1.default)([
            {
                description: 'auth is missing',
                expectDescription: 'request is rejected',
                expectStatus: 401,
                customHeaders: {},
            },
            {
                description: 'no query passed',
                expectDescription: 'return all profiles',
                query: '',
                expectStatus: 200,
                expectFunction: response => {
                    expect(response.body.count).toBe(existingProfiles.length + createdProfiles.length);
                },
            },
            {
                description: 'sort by name desc',
                expectDescription: 'return all profiles, sorted, hasContacts flag set false',
                query: 'sortBy=name',
                expectStatus: 200,
                expectFunction: response => {
                    expect(response.body.count).toBe(existingProfiles.length + createdProfiles.length);
                    expect(response.body.profiles[0].name).toBe('Murray');
                    expect(response.body.profiles[0].hasContacts).toBe(false);
                    expect(response.body.profiles[1].name).toBe('Antonella');
                    expect(response.body.profiles[1].hasContacts).toBe(false);
                    expect(response.body.profiles[1].profileSections.some(ps => ps.sectionType === 'summary')).toBeTruthy();
                    response.body.profiles.slice(2).forEach(p => expect(p.name).toBeNull());
                },
            },
            {
                description: 'sort by name asc',
                expectDescription: 'return all profiles, sorted',
                query: 'sortBy=name&sortDirection=asc',
                expectStatus: 200,
                expectFunction: response => {
                    expect(response.body.count).toBe(existingProfiles.length + createdProfiles.length);
                    expect(response.body.profiles[0].name).toBe('Antonella');
                    expect(response.body.profiles[1].name).toBe('Murray');
                    response.body.profiles.slice(2).forEach(p => expect(p.name).toBeNull());
                },
            },
            {
                description: 'filter by single flag',
                expectDescription: 'return profiles linked to that one flag only',
                query: 'profileFlagIds=1',
                expectStatus: 200,
                expectFunction: response => {
                    expect(response.body.count).toBe(1);
                    expect(response.body.profiles[0].name).toBe('Murray');
                },
            },
            {
                description: 'filter by multiple flags',
                expectDescription: 'return profiles linked to those flag only',
                query: 'profileFlagIds=1,2',
                expectStatus: 200,
                expectFunction: response => {
                    expect(response.body.count).toBe(2);
                    expect(response.body.profiles[0].name).toBe('Antonella');
                    expect(response.body.profiles[1].name).toBe('Murray');
                },
            },
            {
                description: 'filter by flags with no associated profile´',
                expectDescription: 'return zero profiles',
                query: 'profileFlagIds=9999999',
                expectStatus: 200,
                expectFunction: response => {
                    expect(response.body.count).toBe(0);
                },
            },
            {
                description: 'invalid profileFlagIds is provided',
                expectDescription: 'ignore filter',
                query: 'profileFlagIds=not-a-number',
                expectStatus: 200,
                expectFunction: response => {
                    expect(response.body.count).toBe(existingProfiles.length + createdProfiles.length);
                },
            },
        ]).test('when $description, $expectDescription', async ({ expectStatus, customHeaders, query, expectFunction }) => {
            const response = await request
                .get(`${baseRoute}?${query}`)
                .set(customHeaders || server_1.headers);
            expect(response.statusCode).toBe(expectStatus);
            if (expectFunction) {
                expectFunction(response);
            }
        });
    });
    describe('/profiles/identifier/:identifier', () => {
        const buildRoute = (id) => `${baseRoute}/identifier/${id}`;
        const accounts = [accountSid, 'AC_ANOTHER_ACCOUNT'];
        let createdProfiles;
        beforeEach(async () => {
            // Create same identifier for two diferent accounts
            createdProfiles = (await Promise.all(accounts.map(acc => dbConnection_1.db.task(async (t) => (0, profileService_1.getOrCreateProfileWithIdentifier)(t)(acc, {
                identifier: { identifier },
                profile: { name: null, definitionVersion },
            }, { user: (0, twilio_worker_auth_1.newTwilioUser)(accountSid, workerSid, []) })))))
                .map(result => result.unwrap().identifier)
                .reduce((accum, curr) => ({ ...accum, [curr.accountSid]: curr }), {});
        });
        afterEach(async () => (0, dbCleanup_1.clearAllTables)());
        describe('GET', () => {
            test('when identifier not exists, return 404', async () => {
                const response = await request.get(buildRoute('not-exists')).set(server_1.headers);
                expect(response.statusCode).toBe(404);
            });
            test('when identifier exists, return 200', async () => {
                const response = await request.get(buildRoute(identifier)).set(server_1.headers);
                expect(response.statusCode).toBe(200);
                expect(response.body.id).toBe(createdProfiles[accountSid].id);
                expect(response.body.profiles.length).toBe(1);
                expect(response.body.profiles[0].id).toBe(createdProfiles[accountSid].profiles[0].id);
            });
        });
    });
    describe('/profiles/:profileId', () => {
        let createdProfile;
        beforeEach(async () => {
            // Create an identifier
            createdProfile = await dbConnection_1.db.task(async (t) => {
                const result = await (0, profileService_1.getOrCreateProfileWithIdentifier)(t)(accountSid, { identifier: { identifier }, profile: { name: null, definitionVersion } }, { user: (0, twilio_worker_auth_1.newTwilioUser)(accountSid, workerSid, []) });
                return result.unwrap().identifier;
            });
        });
        afterEach(async () => (0, dbCleanup_1.clearAllTables)());
        describe('GET', () => {
            const buildRoute = (id) => `${baseRoute}/${id}`;
            beforeEach(async () => contactApi.createContact(createdProfile.accountSid, workerSid, {
                ...contact1,
                number: identifier,
                taskId: contact1.taskId + createdProfile.profiles[0].id,
                profileId: createdProfile.profiles[0].id,
                identifierId: createdProfile.id,
            }, mocks_1.ALWAYS_CAN, true));
            test('when profile not exists, return 404', async () => {
                const response = await request.get(buildRoute(0)).set(server_1.headers);
                expect(response.statusCode).toBe(404);
            });
            test('when profile exists, return 200 with profile data', async () => {
                const response = await request
                    .get(buildRoute(createdProfile.profiles[0].id))
                    .set(server_1.headers);
                expect(response.statusCode).toBe(200);
                expect(response.body).toMatchObject({
                    ...createdProfile.profiles[0],
                    hasContacts: true,
                });
            });
        });
        describe('', () => {
            const buildRoute = (id, subroute) => `${baseRoute}/${id}/${subroute}`;
            const sortById = (a, b) => parseInt(a.id) - parseInt(b.id);
            let createdCases;
            let createdContacts;
            beforeEach(async () => {
                // Create two cases
                createdCases = await Promise.all([1, 2].map(() => caseApi.createCase(case1, accountSid, workerSid, undefined, true)));
                // Create two contacts for each
                createdContacts = await Promise.all(createdCases.flatMap(createdCase => [1, 2].map(n => contactApi
                    .createContact(createdCase.accountSid, workerSid, {
                    ...contact1,
                    number: identifier,
                    taskId: contact1.taskId + createdCase.id + n,
                    profileId: createdProfile.profiles[0].id,
                    identifierId: createdProfile.id,
                }, mocks_1.ALWAYS_CAN, true)
                    .then(contact => 
                // Associate contact to case
                contactApi.connectContactToCase(contact.accountSid, String(contact.id), String(createdCase.id), {
                    user: (0, twilio_worker_auth_1.newTwilioUser)(contact.accountSid, workerSid, []),
                    can: () => true,
                }, true)))));
                createdCases = await Promise.all(createdCases.map(c => caseApi.getCase(c.id, c.accountSid, mocks_1.ALWAYS_CAN)));
            });
            const convertContactToExpect = (contact) => ({
                ...contact,
                createdAt: expect.toParseAsDate(),
                updatedAt: expect.toParseAsDate(),
                finalizedAt: expect.toParseAsDate(),
                timeOfContact: expect.toParseAsDate(),
                totalCount: expect.anything(),
                id: expect.anything(),
            });
            describe('/profiles/:profileId/contacts', () => {
                describe('GET', () => {
                    // test('when identifier not exists, return 404', async () => {
                    //   const response = await request.get(buildRoute('not-exists')).set(headers);
                    //   expect(response.statusCode).toBe(404);
                    // });
                    test('when profile exists, return 200 with associated contacts', async () => {
                        const response = await request
                            .get(buildRoute(createdProfile.profiles[0].id, 'contacts'))
                            .set(server_1.headers);
                        expect(response.statusCode).toBe(200);
                        expect(response.body.count).toBe(createdContacts.length);
                        expect(response.body.contacts.sort(sortById)).toEqual(expect.objectContaining(createdContacts.sort(sortById).map(convertContactToExpect)));
                    });
                });
            });
            describe('/profiles/:profileId/cases', () => {
                describe('GET', () => {
                    // test('when identifier not exists, return 404', async () => {
                    //   const response = await request.get(buildRoute('not-exists')).set(headers);
                    //   expect(response.statusCode).toBe(404);
                    // });
                    test('when profile exists, return 200 with associated cases', async () => {
                        const response = await request
                            .get(buildRoute(createdProfile.profiles[0].id, 'cases'))
                            .set(server_1.headers);
                        expect(response.statusCode).toBe(200);
                        expect(response.body.count).toBe(createdCases.length);
                        expect(response.body.cases
                            .map(({ createdAt, updatedAt, totalCount, ...rest }) => rest)
                            .sort(sortById)).toStrictEqual(createdCases
                            .map(({ createdAt, updatedAt, ...rest }) => rest)
                            .sort(sortById));
                    });
                });
            });
        });
        describe('/profiles/:profileId/flags', () => {
            describe('/profiles/:profileId/flags/:profileFlagId', () => {
                const buildRoute = (profileId, profileFlagId) => `${baseRoute}/${profileId}/flags/${profileFlagId}`;
                let defaultFlags;
                beforeAll(async () => {
                    defaultFlags = await profilesDB.getProfileFlagsForAccount(accountSid);
                });
                const testCases = [
                    {
                        description: 'auth is missing',
                        expectStatus: 401,
                        customHeaders: {},
                    },
                    {
                        description: 'profile does not exists',
                        profileId: 0,
                        expectStatus: 404,
                    },
                    {
                        description: 'flag does not exists',
                        profileFlagId: 0,
                        expectStatus: 400,
                    },
                    {
                        description: 'profile and flag exist',
                        expectStatus: 200,
                        expectFunction: async (response, profileId, profileFlagId, startTime) => {
                            expect(response.body.id).toBe(profileId);
                            expect(response.body.profileFlags.some(pf => pf.id === profileFlagId)).toBeTruthy();
                            expect(new Date(response.body.updatedAt).getTime()).toBeGreaterThan(startTime);
                        },
                    },
                    {
                        beforeFunction: async (profileId, profileFlagId) => {
                            await request.post(buildRoute(profileId, profileFlagId)).set(server_1.headers);
                        },
                        description: 'association already exists',
                        expectStatus: 409,
                    },
                    {
                        description: 'a valid "validUntil" date is sent',
                        expectStatus: 200,
                        expectFunction: async (response, profileId, profileFlagId, startTime) => {
                            expect(response.body.id).toBe(profileId);
                            expect(response.body.profileFlags.some(pf => pf.id === profileFlagId)).toBeTruthy();
                            expect(new Date(response.body.updatedAt).getTime()).toBeGreaterThan(startTime);
                        },
                    },
                    {
                        description: 'an invalid "validUntil" date is sent',
                        expectStatus: 400,
                        validUntil: 'not a date',
                    },
                    {
                        description: 'a future "validUntil" date is sent',
                        expectStatus: 400,
                        validUntil: '2020-01-05',
                    },
                ];
                describe('POST', () => {
                    (0, jest_each_1.default)(testCases).test('when $description, returns $expectStatus', async ({ beforeFunction, profileId = createdProfile.profiles[0].id, profileFlagId = defaultFlags[0].id, validUntil, expectStatus, customHeaders, expectFunction, }) => {
                        const startTime = Date.now();
                        if (beforeFunction) {
                            await beforeFunction(profileId, profileFlagId);
                        }
                        const response = await request
                            .post(buildRoute(profileId, profileFlagId))
                            .send({ validUntil })
                            .set(customHeaders || server_1.headers);
                        expect(response.statusCode).toBe(expectStatus);
                        if (expectFunction) {
                            await expectFunction(response, profileId, profileFlagId, startTime);
                        }
                    });
                });
                describe('DELETE', () => {
                    beforeEach(async () => {
                        await profilesDB.associateProfileToProfileFlag()(accountSid, createdProfile.profiles[0].id, defaultFlags[0].id, null, { user: (0, twilio_worker_auth_1.newTwilioUser)(accountSid, workerSid, []) });
                        const pfs = (await profilesDB.getProfileById()(accountSid, createdProfile.profiles[0].id)).profileFlags;
                        if (!pfs.some(a => a.id === defaultFlags[0].id)) {
                            throw new Error('Missing expected association');
                        }
                    });
                    (0, jest_each_1.default)([
                        {
                            description: 'auth is missing',
                            expectStatus: 401,
                            customHeaders: {},
                        },
                        {
                            description: 'profile does not exists',
                            profileId: 0,
                            expectStatus: 404,
                        },
                        {
                            description: 'flag does not exists (no-op)',
                            profileFlagId: 0,
                            expectStatus: 200,
                            expectFunction: (response, profileId, profileFlagId, startTime) => {
                                expect(new Date(response.body.updatedAt).getTime()).toBeLessThan((0, date_fns_1.addSeconds)(new Date(startTime), 10).getTime());
                            },
                        },
                        {
                            description: 'profile and flag exist',
                            expectStatus: 200,
                            expectFunction: (response, profileId, profileFlagId, startTime) => {
                                expect(response.body.id).toBe(profileId);
                                expect(response.body.profileFlags).not.toContain(profileFlagId);
                                expect(response.body.updatedBy).toBe(workerSid);
                                expect(new Date(startTime).getTime()).toBeLessThan((0, date_fns_1.addSeconds)(new Date(response.body.updatedAt), 10).getTime());
                            },
                        },
                    ]).test('when $description, returns $expectStatus', async ({ profileId = createdProfile.profiles[0].id, profileFlagId = defaultFlags[0].id, expectStatus, customHeaders, expectFunction, }) => {
                        const startTime = Date.now();
                        const response = await request
                            .delete(buildRoute(profileId, profileFlagId))
                            .set(customHeaders || server_1.headers);
                        expect(response.statusCode).toBe(expectStatus);
                        if (expectFunction) {
                            expectFunction(response, profileId, profileFlagId, startTime);
                        }
                    });
                });
            });
        });
        describe('/profiles/:profileId/sections', () => {
            describe('POST', () => {
                const buildRoute = (profileId) => `${baseRoute}/${profileId}/sections`;
                (0, jest_each_1.default)([
                    {
                        description: 'auth is missing',
                        expectStatus: 401,
                        customHeaders: {},
                    },
                    {
                        description: 'profile does not exists',
                        profileId: 0,
                        expectStatus: 500,
                    },
                    {
                        description: 'profile exist and content is valid',
                        expectStatus: 200,
                        payload: { sectionType: 'note', content: 'a note' },
                        expectFunction: async (response, profileId, payload, startTime) => {
                            expect(response.body.profileId).toBe(profileId);
                            expect(response.body.content).toBe(payload.content);
                            expect(response.body.sectionType).toBe(payload.sectionType);
                            expect(response.body.createdBy).toBe(workerSid);
                            expect(response.body.updatedBy).toBe(null);
                            const updatedProfile = await profilesDB.getProfileById()(accountSid, profileId);
                            expect(updatedProfile.profileSections).toHaveLength(1);
                            expect(updatedProfile.profileSections[0]).toMatchObject({
                                id: response.body.id,
                                sectionType: response.body.sectionType,
                            });
                            expect(new Date(updatedProfile.updatedAt).getTime()).toBeGreaterThan(startTime);
                            expect(updatedProfile.updatedBy).toBe(response.body.createdBy);
                        },
                    },
                ]).test('when $description, returns $expectStatus', async ({ profileId = createdProfile.profiles[0].id, expectStatus, payload, customHeaders, expectFunction, }) => {
                    const startTime = Date.now();
                    const response = await request
                        .post(buildRoute(profileId))
                        .set(customHeaders || server_1.headers)
                        .send(payload);
                    expect(response.statusCode).toBe(expectStatus);
                    if (expectFunction) {
                        await expectFunction(response, profileId, payload, startTime);
                    }
                });
            });
            describe('/profiles/:profileId/sections/:id', () => {
                let createdProfileSection;
                beforeEach(async () => {
                    createdProfileSection = await profilesDB.createProfileSection()(accountSid, {
                        sectionType: 'note',
                        content: 'a note',
                        createdBy: workerSid,
                        profileId: createdProfile.profiles[0].id,
                    });
                });
                const buildRoute = (profileId, sectionId) => `${baseRoute}/${profileId}/sections/${sectionId}`;
                describe('PATCH', () => {
                    (0, jest_each_1.default)([
                        {
                            description: 'auth is missing',
                            expectStatus: 401,
                            customHeaders: {},
                        },
                        {
                            description: 'profile does not exists',
                            profileId: 0,
                            expectStatus: 404,
                        },
                        {
                            description: 'section does not exists',
                            sectionId: 0,
                            expectStatus: 404,
                        },
                        {
                            description: 'profile and section exist',
                            expectStatus: 200,
                            payload: { content: 'a note' },
                            expectFunction: async (response, profileId, payload, startTime) => {
                                expect(response.body.profileId).toBe(profileId);
                                expect(response.body.content).toBe(payload.content);
                                expect(response.body.updatedAt).not.toBe(response.body.createdAt);
                                expect(new Date(response.body.updatedAt).getTime()).toBeGreaterThan(startTime);
                                expect(response.body.updatedBy).not.toBeNull();
                                createdProfileSection = response.body;
                                console.debug('Profile ID', profileId, typeof profileId);
                                const updatedProfile = await profilesDB.getProfileById()(accountSid, typeof profileId !== 'number' ? parseInt(profileId) : profileId);
                                expect(new Date(updatedProfile.updatedAt).getTime()).toBeGreaterThan(startTime);
                                expect(updatedProfile.updatedBy).toBe(response.body.updatedBy);
                            },
                        },
                    ]).test('when $description, returns $expectStatus', async ({ profileId = createdProfile.profiles[0].id, sectionId = createdProfileSection.id, expectStatus, payload, customHeaders, expectFunction, }) => {
                        const startTime = Date.now();
                        const response = await request
                            .patch(buildRoute(profileId, sectionId))
                            .set(customHeaders || server_1.headers)
                            .send(payload);
                        expect(response.statusCode).toBe(expectStatus);
                        if (expectFunction) {
                            expectFunction(response, profileId, payload, startTime);
                        }
                    });
                });
                describe('GET', () => {
                    (0, jest_each_1.default)([
                        {
                            description: 'auth is missing',
                            expectStatus: 401,
                            customHeaders: {},
                        },
                        {
                            description: 'profile does not exists',
                            profileId: 0,
                            expectStatus: 404,
                        },
                        {
                            description: 'section does not exists',
                            sectionId: 0,
                            expectStatus: 404,
                        },
                        {
                            description: 'profile and section exist',
                            expectStatus: 200,
                            expectFunction: (response, profileId) => {
                                expect(response.body.profileId).toBe(profileId);
                                expect(response.body).toMatchObject(createdProfileSection);
                            },
                        },
                    ]).test('when $description, returns $expectStatus', async ({ profileId = createdProfile.profiles[0].id, sectionId = createdProfileSection.id, expectStatus, payload, customHeaders, expectFunction, }) => {
                        const response = await request
                            .get(buildRoute(profileId, sectionId))
                            .set(customHeaders || server_1.headers);
                        expect(response.statusCode).toBe(expectStatus);
                        if (expectFunction) {
                            expectFunction(response, profileId, payload);
                        }
                    });
                });
            });
        });
    });
    describe('/profiles/flags', () => {
        describe('GET', () => {
            const defaultFlags = ['abusive', 'blocked'];
            const route = `${baseRoute}/flags`;
            test('when no custom flags are added, return default flags', async () => {
                const response = await request.get(route).set(server_1.headers);
                expect(response.statusCode).toBe(200);
                // We know that there are two "default" flags that every account has: "abusive" and "blocked"
                expect(response.body).toHaveLength(defaultFlags.length);
                defaultFlags.forEach(flag => {
                    expect(response.body.find(f => f.name === flag)).toBeDefined();
                });
            });
            test('when custom flags are added, return default and custom flags', async () => {
                const customFlag = await profilesDB.createProfileFlag(accountSid, {
                    name: 'custom',
                    createdBy: workerSid,
                });
                const customFlagForAnother = await profilesDB.createProfileFlag('AC-ANOTHER_ACCOUNT', {
                    name: 'custom 2',
                    createdBy: workerSid,
                });
                const response = await request.get(route).set(server_1.headers);
                expect(response.statusCode).toBe(200);
                // We know that there are two "default" flags that every account has: "abusive" and "blocked"
                expect(response.body).toHaveLength(defaultFlags.length + 1);
                defaultFlags.forEach(flag => {
                    expect(response.body.find(f => f.name === flag)).toBeDefined();
                });
                expect(response.body.find(f => f.name === customFlag.name)).toBeDefined();
                expect(response.body.find(f => f.name === customFlagForAnother.name)).not.toBeDefined();
                await deleteFromTableById('ProfileFlags')(customFlag.id, customFlag.accountSid);
                await deleteFromTableById('ProfileFlags')(customFlagForAnother.id, customFlagForAnother.accountSid);
            });
        });
    });
});

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

import each from 'jest-each';
import './case-validation';
import { db } from '../src/connection-pool';
import * as caseApi from '../src/case/case';
import * as contactApi from '../src/contact/contact';
import * as profilesDB from '../src/profile/profile-data-access';
import { getRequest, getServer, headers, useOpenRules } from './server';
import * as mocks from './mocks';
import { mockSuccessfulTwilioAuthentication, mockingProxy } from '@tech-matters/testing';
import { getOrCreateProfileWithIdentifier } from '../src/profile/profile';
import { IdentifierWithProfiles } from '../src/profile/profile-data-access';
import { twilioUser } from '@tech-matters/twilio-worker-auth';

useOpenRules();
const server = getServer();
const request = getRequest(server);

const { case1, accountSid, workerSid, contact1 } = mocks;

// eslint-disable-next-line @typescript-eslint/no-shadow
const deleteFromTableById = (table: string) => async (id: number, accountSid: string) =>
  db.task(t =>
    t.none(`
  DELETE FROM "${table}" WHERE "id" = ${id} AND "accountSid" = '${accountSid}'
`),
  );

afterAll(done => {
  mockingProxy.stop().finally(() => {
    server.close(done);
  });
});

beforeAll(async () => {
  await mockingProxy.start();
});

beforeEach(async () => {
  await mockSuccessfulTwilioAuthentication(workerSid);
});

describe('/profiles route', () => {
  const baseRoute = `/v0/accounts/${accountSid}/profiles`;
  const identifier = 'identifier';

  describe('/identifier/:identifier', () => {
    const buildRoute = (id: string) => `${baseRoute}/identifier/${id}`;
    const accounts = [accountSid, 'ANOTHER_ACCOUNT'];

    let createdProfiles: { [acc: string]: IdentifierWithProfiles };
    let createdCases: { [acc: string]: caseApi.Case };
    let createdContacts: { [acc: string]: contactApi.Contact };
    beforeAll(async () => {
      // Create same identifier for two diferent accounts
      createdProfiles = (
        await Promise.all(
          accounts.map(acc => getOrCreateProfileWithIdentifier()(identifier, acc)),
        )
      )
        .map(result => result.unwrap())
        .reduce((accum, curr) => ({ ...accum, [curr.accountSid]: curr }), {});
      // Create one case for each
      createdCases = (
        await Promise.all(accounts.map(acc => caseApi.createCase(case1, acc, workerSid)))
      ).reduce((accum, curr) => ({ ...accum, [curr.accountSid]: curr }), {});

      // Create one contact for each
      createdContacts = (
        await Promise.all(
          accounts.map(acc =>
            contactApi.createContact(
              acc,
              workerSid,
              true,
              {
                ...contact1,
                number: identifier,
                profileId: createdProfiles[acc].profiles[0].id,
                identifierId: createdProfiles[acc].id,
              },
              {
                user: twilioUser(workerSid, []),
                can: () => true,
              },
            ),
          ),
        )
      ).reduce((accum, curr) => ({ ...accum, [curr.accountSid]: curr }), {});

      // Associate contacts to cases
      await Promise.all(
        accounts.map(acc =>
          contactApi.connectContactToCase(
            createdContacts[acc].accountSid,
            workerSid,
            String(createdContacts[acc].id),
            String(createdCases[acc].id),
            {
              user: twilioUser(workerSid, []),
              can: () => true,
            },
          ),
        ),
      );
    });

    afterAll(async () => {
      await Promise.all(
        Object.entries(createdContacts).map(([, c]) =>
          deleteFromTableById('Contacts')(c.id, c.accountSid),
        ),
      );
      await Promise.all(
        Object.entries(createdCases).map(([, c]) =>
          deleteFromTableById('Cases')(c.id, c.accountSid),
        ),
      );
      await Promise.all(
        Object.entries(createdProfiles).flatMap(([, idWithp]) => [
          ...idWithp.profiles.map(p =>
            deleteFromTableById('Profiles')(p.id, p.accountSid),
          ),
          deleteFromTableById('Identifiers')(idWithp.id, idWithp.accountSid),
        ]),
      );
    });

    describe('GET', () => {
      test('when identifier not exists, return 404', async () => {
        const response = await request.get(buildRoute('not-exists')).set(headers);
        expect(response.statusCode).toBe(404);
      });

      test('when identifier exists, return 200', async () => {
        const response = await request.get(buildRoute(identifier)).set(headers);
        expect(response.statusCode).toBe(200);
        expect(response.body.id).toBe(createdProfiles[accountSid].id);
        expect(response.body.profiles.length).toBe(1);
        expect(response.body.profiles[0].id).toBe(
          createdProfiles[accountSid].profiles[0].id,
        );
        expect(response.body.profiles[0].contactsCount).toBe(1);
        expect(response.body.profiles[0].casesCount).toBe(1);
      });
    });
  });

  describe('/:profileId', () => {
    let createdProfile: IdentifierWithProfiles;
    beforeAll(async () => {
      // Create an identifier
      createdProfile = await getOrCreateProfileWithIdentifier()(
        identifier,
        accountSid,
      ).then(result => result.unwrap());
    });

    afterAll(async () => {
      await Promise.all([
        ...createdProfile.profiles.map(p =>
          deleteFromTableById('Profiles')(p.id, p.accountSid),
        ),
        deleteFromTableById('Identifiers')(createdProfile.id, createdProfile.accountSid),
      ]);
    });

    describe('GET', () => {
      const buildRoute = (id: number) => `${baseRoute}/${id}`;

      test('when profile not exists, return 404', async () => {
        const response = await request.get(buildRoute(0)).set(headers);

        expect(response.statusCode).toBe(404);
      });

      test('when profile exists, return 200 with profile data', async () => {
        const response = await request
          .get(buildRoute(createdProfile.profiles[0].id))
          .set(headers);

        expect(response.statusCode).toBe(200);
        console.log(response.body);
        expect(response.body).toMatchObject(createdProfile.profiles[0]);
      });
    });

    describe('', () => {
      const buildRoute = (id: number, subroute: 'contacts' | 'cases') =>
        `${baseRoute}/${id}/${subroute}`;

      const sortById = (a: { id: number }, b: { id: number }) => a.id - b.id;

      let createdCases: caseApi.Case[];
      let createdContacts: Awaited<ReturnType<typeof contactApi.createContact>>[];
      beforeAll(async () => {
        // Create two cases
        createdCases = await Promise.all(
          [1, 2].map(() => caseApi.createCase(case1, accountSid, workerSid)),
        );

        // Create two contacts for each
        createdContacts = await Promise.all(
          createdCases.flatMap(createdCase =>
            [1, 2].map(n =>
              contactApi
                .createContact(
                  createdCase.accountSid,
                  workerSid,
                  true,
                  {
                    ...contact1,
                    number: identifier,
                    taskId: contact1.taskId + createdCase.id + n,
                    profileId: createdProfile.profiles[0].id,
                    identifierId: createdProfile.id,
                  },
                  {
                    user: twilioUser(workerSid, []),
                    can: () => true,
                  },
                )
                .then(contact =>
                  // Associate contact to case
                  contactApi.connectContactToCase(
                    contact.accountSid,
                    workerSid,
                    String(contact.id),
                    String(createdCase.id),
                    {
                      user: twilioUser(workerSid, []),
                      can: () => true,
                    },
                  ),
                ),
            ),
          ),
        );

        createdCases = await Promise.all(
          createdCases.map(c =>
            caseApi.getCase(c.id, c.accountSid, {
              user: twilioUser(workerSid, []),
              can: () => true,
            }),
          ) as any,
        );
      });

      afterAll(async () => {
        await Promise.all(
          Object.entries(createdContacts).map(([, c]) =>
            deleteFromTableById('Contacts')(c.id, c.accountSid),
          ),
        );
        await Promise.all(
          Object.entries(createdCases).map(([, c]) =>
            deleteFromTableById('Cases')(c.id, c.accountSid),
          ),
        );
      });

      const convertContactToExpect = (
        contact: contactApi.WithLegacyCategories<contactApi.Contact>,
      ) => ({
        ...contact,
        createdAt: expect.toParseAsDate(),
        updatedAt: expect.toParseAsDate(),
        finalizedAt: expect.toParseAsDate(),
        timeOfContact: expect.toParseAsDate(),
        totalCount: expect.anything(),
        id: expect.anything(),
      });

      describe('/contacts', () => {
        describe('GET', () => {
          // test('when identifier not exists, return 404', async () => {
          //   const response = await request.get(buildRoute('not-exists')).set(headers);
          //   expect(response.statusCode).toBe(404);
          // });

          test('when profile exists, return 200 with associated contacts', async () => {
            const response = await request
              .get(buildRoute(createdProfile.profiles[0].id, 'contacts'))
              .set(headers);

            expect(response.statusCode).toBe(200);
            expect(response.body.count).toBe(createdContacts.length);
            expect(response.body.contacts.sort(sortById)).toEqual(
              expect.objectContaining(
                createdContacts.sort(sortById).map(convertContactToExpect),
              ),
            );
          });
        });
      });

      describe('/cases', () => {
        describe('GET', () => {
          // test('when identifier not exists, return 404', async () => {
          //   const response = await request.get(buildRoute('not-exists')).set(headers);
          //   expect(response.statusCode).toBe(404);
          // });

          test('when profile exists, return 200 with associated cases', async () => {
            const response = await request
              .get(buildRoute(createdProfile.profiles[0].id, 'cases'))
              .set(headers);

            expect(response.statusCode).toBe(200);
            expect(response.body.count).toBe(createdCases.length);
            expect(
              response.body.cases
                .map(({ createdAt, updatedAt, childName, totalCount, ...rest }) => ({
                  ...rest,
                  connectedContacts: rest.connectedContacts?.sort(sortById),
                }))
                .sort(sortById),
            ).toStrictEqual(
              createdCases
                .map(({ createdAt, updatedAt, childName, ...rest }) => ({
                  ...rest,
                  connectedContacts: rest.connectedContacts?.sort(sortById),
                }))
                .sort(sortById),
            );
          });
        });
      });
    });

    describe('/:profileFlagId', () => {
      const buildRoute = (profileId: number, profileFlagId: number) =>
        `${baseRoute}/${profileId}/flags/${profileFlagId}`;

      let defaultFlags: profilesDB.ProfileFlag[];
      beforeAll(async () => {
        defaultFlags = await profilesDB
          .getProfileFlagsForAccount(accountSid)
          .then(result => result.unwrap());
      });

      describe('POST', () => {
        afterAll(async () => {
          // Dissasociate
          db.task(t =>
            t.none(
              `DELETE FROM "ProfilesToProfileFlags" WHERE "profileId" = ${createdProfile.profiles[0].id}`,
            ),
          );
        });

        each([
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
            description: 'flag does not exists',
            profileFlagId: 0,
            expectStatus: 500,
          },
          {
            description: 'profile and flag exist',
            expectStatus: 200,
            expectFunction: (response, profileId, profileFlagId) => {
              expect(response.body.id).toBe(profileId);
              expect(response.body.profileFlags).toContain(profileFlagId);
            },
          },
          {
            description: 'association already exists',
            expectStatus: 500,
          },
        ]).test(
          'when $description, returns $expectStatus',
          async ({
            profileId = createdProfile.profiles[0].id,
            profileFlagId = defaultFlags[0].id,
            expectStatus,
            customHeaders,
            expectFunction,
          }) => {
            const response = await request
              .post(buildRoute(profileId, profileFlagId))
              .set(customHeaders || headers);
            expect(response.statusCode).toBe(expectStatus);
            console.log(response.body);
            if (expectFunction) {
              expectFunction(response, profileId, profileFlagId);
            }
          },
        );
      });

      describe('DELETE', () => {
        beforeAll(async () => {
          (
            await profilesDB.associateProfileToProfileFlag()(
              accountSid,
              createdProfile.profiles[0].id,
              defaultFlags[0].id,
            )
          ).unwrap();

          const pfs = (
            await profilesDB.getProfileById()(accountSid, createdProfile.profiles[0].id)
          ).profileFlags;
          if (!pfs.includes(defaultFlags[0].id)) {
            throw new Error('Missing expected association');
          }
        });

        afterAll(async () => {
          // Dissasociate
          await db.task(t =>
            t.none(
              `DELETE FROM "ProfilesToProfileFlags" WHERE "profileId" = ${createdProfile.profiles[0].id}`,
            ),
          );
        });

        each([
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
          },
          {
            description: 'profile and flag exist',
            expectStatus: 200,
            expectFunction: (response, profileId, profileFlagId) => {
              expect(response.body.id).toBe(profileId);
              expect(response.body.profileFlags).not.toContain(profileFlagId);
            },
          },
        ]).test(
          'when $description, returns $expectStatus',
          async ({
            profileId = createdProfile.profiles[0].id,
            profileFlagId = defaultFlags[0].id,
            expectStatus,
            customHeaders,
            expectFunction,
          }) => {
            const response = await request
              .delete(buildRoute(profileId, profileFlagId))
              .set(customHeaders || headers);
            expect(response.statusCode).toBe(expectStatus);
            console.log(response.body);
            if (expectFunction) {
              expectFunction(response, profileId, profileFlagId);
            }
          },
        );
      });
    });
  });

  describe('/flags', () => {
    describe('GET', () => {
      const defaultFlags = ['abusive', 'blocked'];

      const route = `${baseRoute}/flags`;

      test('when no custom flags are added, return default flags', async () => {
        const response = await request.get(route).set(headers);

        expect(response.statusCode).toBe(200);
        // We know that there are two "default" flags that every account has: "abusive" and "blocked"
        expect(response.body).toHaveLength(defaultFlags.length);
        defaultFlags.forEach(flag => {
          expect(response.body.find(f => f.name === flag)).toBeDefined();
        });
      });

      test('when custom flags are added, return default and custom flags', async () => {
        const customFlag = (
          await profilesDB.createProfileFlag(accountSid, {
            name: 'custom',
          })
        ).unwrap();

        const customFlagForAnother = (
          await profilesDB.createProfileFlag('ANOTHER_ACCOUNT', {
            name: 'custom 2',
          })
        ).unwrap();

        const response = await request.get(route).set(headers);

        expect(response.statusCode).toBe(200);
        // We know that there are two "default" flags that every account has: "abusive" and "blocked"
        expect(response.body).toHaveLength(defaultFlags.length + 1);
        defaultFlags.forEach(flag => {
          expect(response.body.find(f => f.name === flag)).toBeDefined();
        });

        expect(response.body.find(f => f.name === customFlag.name)).toBeDefined();
        expect(
          response.body.find(f => f.name === customFlagForAnother.name),
        ).not.toBeDefined();

        deleteFromTableById('ProfileFlags')(customFlag.id, customFlag.accountSid);
        deleteFromTableById('ProfileFlags')(
          customFlagForAnother.id,
          customFlagForAnother.accountSid,
        );
      });
    });
  });
});

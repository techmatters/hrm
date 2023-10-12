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

import {
  ContactRawJson,
  CreateContactPayload,
  PatchPayload,
  WithLegacyCategories,
} from '../../src/contact/contact';
import '../case-validation';
import * as contactApi from '../../src/contact/contact';
import { accountSid, contact1, withTaskIdAndTranscript, workerSid } from '../mocks';
import { twilioUser } from '@tech-matters/twilio-worker-auth/dist';
import each from 'jest-each';
import { getRequest, getServer, headers, setRules, useOpenRules } from '../server';
import * as contactDb from '../../src/contact/contact-data-access';
import { ruleFileWithOneActionOverride } from '../permissions-overrides';
import { isS3StoredTranscript } from '../../src/conversation-media/conversation-media-data-access';
import { mockingProxy, mockSuccessfulTwilioAuthentication } from '@tech-matters/testing';
import {
  cleanupCases,
  cleanupContacts,
  cleanupContactsJobs,
  cleanupCsamReports,
  cleanupReferrals,
  deleteContactById,
  deleteJobsByContactId,
} from './db-cleanup';

type ContactRawJsonWithLegacyCategories =
  WithLegacyCategories<contactDb.Contact>['rawJson'];

useOpenRules();
const server = getServer();
const request = getRequest(server);
const route = `/v0/accounts/${accountSid}/contacts`;

const cleanup = async () => {
  await mockingProxy.start();
  await mockSuccessfulTwilioAuthentication(workerSid);
  await cleanupCsamReports();
  await cleanupReferrals();
  await cleanupContactsJobs();
  await cleanupContacts();
  await cleanupCases();
};

beforeAll(() => {
  process.env[`TWILIO_AUTH_TOKEN_${accountSid}`] = 'mockAuthToken';
});

beforeEach(cleanup);

afterAll(cleanup);

describe('/contacts/:contactId route', () => {
  describe('PATCH', () => {
    type TestOptions = {
      patch: PatchPayload['rawJson'];
      description: string;
      original?: ContactRawJson;
      expected: ContactRawJsonWithLegacyCategories;
    };
    const subRoute = contactId => `${route}/${contactId}`;

    test('should return 401', async () => {
      const createdContact = await contactApi.createContact(
        accountSid,
        workerSid,
        true,
        {
          ...contact1,
          rawJson: <ContactRawJson>{},
          csamReports: [],
        },
        { user: twilioUser(workerSid, []), can: () => true },
      );
      const response = await request.patch(subRoute(createdContact.id)).send({});

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authorization failed');
    });
    describe('rawJson changes', () => {
      const sampleRawJson: ContactRawJson = {
        ...(contact1.rawJson as ContactRawJson),
        categories: {
          a: ['a2'],
          b: ['b1'],
        },
      };
      const sampleRawJsonWithLegacyCategories = {
        ...sampleRawJson,
        caseInformation: {
          ...sampleRawJson.caseInformation,
          categories: {
            a: { a2: true },
            b: { b1: true },
          },
        },
      };
      const tests: TestOptions[] = [
        {
          description: 'set callType to data call type',
          patch: {
            callType: 'Child calling about self',
          },
          expected: {
            callType: 'Child calling about self',
            caseInformation: {
              categories: {},
            },
          },
        },
        {
          description: 'set callType to non data call type',
          patch: {
            callType: 'Hang up',
          },
          expected: {
            callType: 'Hang up',
            caseInformation: {
              categories: {},
            },
          },
        },
        {
          description: 'add child information',
          patch: {
            childInformation: {
              firstName: 'Lorna',
              lastName: 'Ballantyne',
              some: 'property',
            },
          },
          expected: {
            childInformation: {
              firstName: 'Lorna',
              lastName: 'Ballantyne',
              some: 'property',
            },
            caseInformation: {
              categories: {},
            },
          },
        },
        {
          description: 'add caller information',
          patch: {
            callerInformation: {
              firstName: 'Lorna',
              lastName: 'Ballantyne',
              some: 'other property',
            },
          },
          expected: {
            callerInformation: {
              firstName: 'Lorna',
              lastName: 'Ballantyne',
              some: 'other property',
            },
            caseInformation: {
              categories: {},
            },
          },
        },
        {
          description: 'add case information and categories',
          patch: {
            caseInformation: {
              other: 'case property',
            },
            categories: {
              category1: ['subcategory1', 'subcategory2'],
            },
          },
          expected: {
            categories: {
              category1: ['subcategory1', 'subcategory2'],
            },
            caseInformation: {
              other: 'case property',
              categories: {
                category1: { subcategory1: true, subcategory2: true },
              },
            },
          },
        },
        {
          description: 'add case information',
          patch: {
            caseInformation: {
              other: 'case property',
            },
          },
          expected: {
            caseInformation: {
              other: 'case property',
              categories: {},
            },
          },
        },
        {
          description: 'add categories',
          patch: {
            categories: {
              category1: ['subcategory1', 'subcategory2'],
            },
            caseInformation: {},
          },
          expected: {
            caseInformation: {
              categories: {
                category1: { subcategory1: true, subcategory2: true },
              },
            },
            categories: {
              category1: ['subcategory1', 'subcategory2'],
            },
          },
        },

        {
          description: 'overwrite callType as data call type',
          original: sampleRawJson,
          patch: {
            callType: 'Child calling about self',
          },
          expected: {
            ...sampleRawJsonWithLegacyCategories,
            callType: 'Child calling about self',
          },
        },
        {
          description: 'overwrite callType as non data call type',
          original: sampleRawJson,
          patch: {
            callType: 'Hang up',
          },
          expected: {
            ...sampleRawJsonWithLegacyCategories,
            callType: 'Hang up',
          },
        },
        {
          description: 'overwrite child information',
          original: sampleRawJson,
          patch: {
            childInformation: {
              firstName: 'Lorna',
              lastName: 'Ballantyne',
              some: 'property',
            },
          },
          expected: {
            ...sampleRawJsonWithLegacyCategories,
            childInformation: {
              firstName: 'Lorna',
              lastName: 'Ballantyne',
              some: 'property',
            },
          },
        },
        {
          original: sampleRawJson,
          description: 'overwrite caller information',
          patch: {
            callerInformation: {
              firstName: 'Lorna',
              lastName: 'Ballantyne',
              some: 'other property',
            },
          },
          expected: {
            ...sampleRawJsonWithLegacyCategories,
            callerInformation: {
              firstName: 'Lorna',
              lastName: 'Ballantyne',
              some: 'other property',
            },
          },
        },
        {
          original: sampleRawJson,
          description: 'overwrite case information and categories',
          patch: {
            caseInformation: {
              other: 'overwrite case property',
            },
            categories: {
              category1: ['subcategory1', 'subcategory2'],
            },
          },
          expected: {
            ...sampleRawJsonWithLegacyCategories,
            caseInformation: {
              other: 'overwrite case property',
              categories: {
                category1: { subcategory1: true, subcategory2: true },
              },
            },
            categories: {
              category1: ['subcategory1', 'subcategory2'],
            },
          },
        },
        {
          original: sampleRawJson,
          description: 'overwrite case information',
          patch: {
            caseInformation: {
              other: 'case property',
            },
          },
          expected: {
            ...sampleRawJsonWithLegacyCategories,
            caseInformation: {
              other: 'case property',
              categories: sampleRawJsonWithLegacyCategories.caseInformation.categories,
            },
          },
        },
        {
          original: sampleRawJson,
          description: 'overwrite categories',
          patch: {
            categories: {
              category1: ['subcategory1', 'subcategory2'],
            },
          },
          expected: {
            ...sampleRawJsonWithLegacyCategories,
            caseInformation: {
              ...sampleRawJsonWithLegacyCategories.caseInformation,
              categories: {
                category1: {
                  subcategory1: true,
                  subcategory2: true,
                },
              },
            },

            categories: {
              category1: ['subcategory1', 'subcategory2'],
            },
          },
        },
      ];
      each(tests).test(
        'should $description if that is specified in the payload',
        async ({ patch, expected, original }: TestOptions) => {
          const createdContact = await contactApi.createContact(
            accountSid,
            workerSid,
            true,
            {
              ...contact1,
              rawJson: original || <ContactRawJson>{},
              csamReports: [],
            },
            { user: twilioUser(workerSid, []), can: () => true },
          );
          try {
            const existingContactId = createdContact.id;
            const response = await request
              .patch(subRoute(existingContactId))
              .set(headers)
              .send({ rawJson: patch });

            expect(response.status).toBe(200);
            const { categories, ...caseInformationWithoutLegacyCategories } =
              expected?.caseInformation ?? {};
            const expectedInDb: Partial<ContactRawJson> = expected?.caseInformation
              ? {
                  ...expected,
                  caseInformation: caseInformationWithoutLegacyCategories as Record<
                    string,
                    string | boolean
                  >,
                }
              : (expected as Partial<ContactRawJson>);
            // Bodge a corner case where an absent caseInformation is untouched by the patch operation
            if (
              !original?.caseInformation &&
              !patch?.caseInformation &&
              !patch?.categories
            ) {
              delete expectedInDb.caseInformation;
            }
            expect(response.body).toStrictEqual({
              ...createdContact,
              timeOfContact: expect.toParseAsDate(createdContact.timeOfContact),
              createdAt: expect.toParseAsDate(createdContact.createdAt),
              finalizedAt: expect.toParseAsDate(createdContact.finalizedAt),
              updatedAt: expect.toParseAsDate(),
              updatedBy: workerSid,
              rawJson: expected,
              csamReports: [],
              referrals: [],
            });
            // Test the association
            expect(response.body.csamReports).toHaveLength(0);
            const savedContact = await contactDb.getById(accountSid, existingContactId);

            expect(savedContact).toStrictEqual({
              ...createdContact,
              createdAt: expect.toParseAsDate(createdContact.createdAt),
              updatedAt: expect.toParseAsDate(),
              updatedBy: workerSid,
              rawJson: expectedInDb,
              csamReports: [],
              referrals: [],
            });
          } finally {
            await deleteContactById(createdContact.id, createdContact.accountSid);
          }
        },
      );
    });

    describe('Changes outside rawJson', () => {
      beforeEach(async () => {
        // Clean what's been created so far
        await cleanupCsamReports();
        await cleanupReferrals();
        await cleanupContactsJobs();
        await cleanupContacts();
        await cleanupCases();
      });

      test('Not permitted on finalized contact', async () => {
        const createdContact = await contactApi.createContact(
          accountSid,
          workerSid,
          true,
          contact1,
          { user: twilioUser(workerSid, []), can: () => true },
        );
        const response = await request
          .patch(subRoute(createdContact.id))
          .set(headers)
          .send({ conversationDuration: 1337 });

        expect(response.status).toBe(401);
      });

      type FullPatchTestOptions = {
        patch: PatchPayload;
        description: string;
        originalDifferences?: PatchPayload;
        expectedDifferences?: PatchPayload;
        finalize?: boolean;
      };

      const testCases: FullPatchTestOptions[] = [
        {
          description: 'patches conversationDuration',
          patch: {
            conversationDuration: 1337,
          },
          expectedDifferences: {
            conversationDuration: 1337,
          },
          originalDifferences: {
            conversationDuration: 42,
          },
        },
        {
          description: 'finalize contact',
          finalize: true,
          patch: {
            conversationDuration: 1337,
          },
          expectedDifferences: {
            conversationDuration: 1337,
            finalizedAt: expect.toParseAsDate(),
          },
          originalDifferences: {
            conversationDuration: 42,
          },
        },
      ];
      each(testCases).test(
        'should $description if that is specified in the payload for a draft contact',
        async ({
          patch,
          expectedDifferences,
          originalDifferences,
          finalize = false,
        }: FullPatchTestOptions) => {
          const original: CreateContactPayload = {
            ...contact1,
            ...originalDifferences,
            rawJson: {
              ...contact1.rawJson,
              ...originalDifferences?.rawJson,
            },
          };
          const createdContact = await contactApi.createContact(
            accountSid,
            workerSid,
            false,
            original,
            { user: twilioUser(workerSid, []), can: () => true },
          );
          const expected: WithLegacyCategories<contactDb.Contact> = {
            ...createdContact,
            ...expectedDifferences,
            rawJson: {
              ...createdContact.rawJson,
              ...expectedDifferences?.rawJson,
              caseInformation: {
                ...createdContact.rawJson!.caseInformation,
                ...expectedDifferences?.rawJson?.caseInformation,
                categories: {},
              },
            },
          };
          try {
            const existingContactId = createdContact.id;
            const response = await request
              .patch(`${subRoute(existingContactId)}?finalize=${finalize}`)
              .set(headers)
              .send(patch);

            expect(response.status).toBe(200);
            const { categories, ...caseInformationWithoutLegacyCategories } =
              expected.rawJson?.caseInformation ?? {};
            const expectedInDb: contactApi.Contact = expected.rawJson?.caseInformation
              ? ({
                  ...expected,
                  rawJson: {
                    ...expected.rawJson,
                    caseInformation: caseInformationWithoutLegacyCategories as Record<
                      string,
                      string | boolean
                    >,
                  },
                } as contactApi.Contact)
              : (expected as contactApi.Contact);
            // Bodge a corner case where an absent caseInformation is untouched by the patch operation
            if (
              !original.rawJson?.caseInformation &&
              !patch.rawJson?.caseInformation &&
              !patch.rawJson?.categories
            ) {
              delete (expectedInDb.rawJson as any).caseInformation;
            }
            expect(response.body).toStrictEqual({
              ...expected,
              timeOfContact: expect.toParseAsDate(expected.timeOfContact),
              createdAt: expect.toParseAsDate(expected.createdAt),
              updatedAt: expect.toParseAsDate(),
              updatedBy: workerSid,
              referrals: [],
            });
            // Test the association
            expect(response.body.csamReports).toHaveLength(0);
            const savedContact = await contactDb.getById(accountSid, existingContactId);

            expect(savedContact).toStrictEqual({
              ...expectedInDb,
              createdAt: expect.toParseAsDate(createdContact.createdAt),
              updatedAt: expect.toParseAsDate(),
              updatedBy: workerSid,
              csamReports: [],
              referrals: [],
            });
          } finally {
            await deleteContactById(createdContact.id, createdContact.accountSid);
          }
        },
      );
    });

    test('use non-existent contactId should return 404', async () => {
      const contactToBeDeleted = await contactApi.createContact(
        accountSid,
        workerSid,
        true,
        <any>contact1,
        { user: twilioUser(workerSid, []), can: () => true },
      );
      const nonExistingContactId = contactToBeDeleted.id;
      await deleteContactById(contactToBeDeleted.id, contactToBeDeleted.accountSid);
      const response = await request
        .patch(subRoute(nonExistingContactId))
        .set(headers)
        .send({
          rawJson: {
            name: { firstName: 'Lorna', lastName: 'Ballantyne' },
            some: 'property',
          },
        });

      expect(response.status).toBe(404);
    });

    test("Draft contact edited by a user that didn't create or own the contact - returns 401", async () => {
      const createdContact = await contactApi.createContact(
        accountSid,
        'another creator',
        false,
        <any>{
          ...contact1,
          twilioWorkerId: 'another owner',
        },
        { user: twilioUser('another creator', []), can: () => true },
      );
      const response = await request
        .patch(subRoute(createdContact.id))
        .set(headers)
        .send();

      expect(response.status).toBe(401);
    });

    test('Draft contact edited by a user that owns the contact - returns 200', async () => {
      const createdContact = await contactApi.createContact(
        accountSid,
        'another creator',
        false,
        <any>contact1,
        { user: twilioUser(workerSid, []), can: () => true },
      );
      const response = await request
        .patch(subRoute(createdContact.id))
        .set(headers)
        .send();

      expect(response.status).toBe(200);
    });

    test('Draft contact edited by a user that created the contact - returns 200', async () => {
      const createdContact = await contactApi.createContact(
        accountSid,
        workerSid,
        false,
        <any>{
          ...contact1,
          twilioWorkerId: 'another owner',
        },
        { user: twilioUser(workerSid, []), can: () => true },
      );
      const response = await request
        .patch(subRoute(createdContact.id))
        .set(headers)
        .send();

      expect(response.status).toBe(200);
    });

    test('malformed payload should return 400', async () => {
      const contact = await contactApi.createContact(
        accountSid,
        workerSid,
        true,
        <any>{ ...contact1, taskId: 'malformed-task-id' },
        { user: twilioUser(workerSid, []), can: () => true },
      );
      const response = await request.patch(subRoute(contact.id)).set(headers).send([]);

      expect(response.status).toBe(400);
    });

    test('no body should be a noop', async () => {
      const createdContact = await contactApi.createContact(
        accountSid,
        workerSid,
        true,
        <any>contact1,
        { user: twilioUser(workerSid, []), can: () => true },
      );
      const response = await request
        .patch(subRoute(createdContact.id))
        .set(headers)
        .send();

      expect(response.status).toBe(200);
      expect(response.body).toStrictEqual({
        ...createdContact,
        timeOfContact: expect.toParseAsDate(createdContact.timeOfContact),
        createdAt: expect.toParseAsDate(createdContact.createdAt),
        finalizedAt: expect.toParseAsDate(createdContact.finalizedAt),
        updatedAt: expect.toParseAsDate(),
        updatedBy: workerSid,
      });
    });

    each([
      {
        expectTranscripts: true,
        description: `with viewExternalTranscript includes transcripts`,
      },
      {
        expectTranscripts: false,
        description: `without viewExternalTranscript excludes transcripts`,
      },
    ]).test(`$description`, async ({ expectTranscripts }) => {
      const createdContact = await contactApi.createContact(
        accountSid,
        workerSid,
        true,
        withTaskIdAndTranscript,
        { user: twilioUser(workerSid, []), can: () => true },
      );
      if (!expectTranscripts) {
        setRules(ruleFileWithOneActionOverride('viewExternalTranscript', false));
      } else {
        useOpenRules();
      }

      const res = await request
        .patch(`${route}/${createdContact.id}`)
        .set(headers)
        .send({ rawJson: createdContact.rawJson });
      expect(res.status).toBe(200);

      if (expectTranscripts) {
        expect(
          (<contactApi.Contact>res.body).conversationMedia?.some(isS3StoredTranscript),
        ).toBeTruthy();
        expect(
          (<contactApi.Contact>res.body).rawJson?.conversationMedia?.some(
            cm => cm.store === 'S3',
          ),
        ).toBeTruthy();
      } else {
        expect(
          (<contactApi.Contact>res.body).conversationMedia?.some(isS3StoredTranscript),
        ).toBeFalsy();
        expect(
          (<contactApi.Contact>res.body).rawJson?.conversationMedia?.some(
            cm => cm.store === 'S3',
          ),
        ).toBeFalsy();
      }

      await deleteJobsByContactId(createdContact.id, createdContact.accountSid);
      await deleteContactById(createdContact.id, createdContact.accountSid);
      useOpenRules();
    });
  });
});

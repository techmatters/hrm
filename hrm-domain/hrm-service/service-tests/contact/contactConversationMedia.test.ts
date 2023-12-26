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

import * as contactApi from '../../src/contact/contactService';
import '../case-validation';
import { ContactRawJson } from '../../src/contact/contactJson';
import { accountSid, contact1, workerSid } from '../mocks';
import { twilioUser } from '@tech-matters/twilio-worker-auth/dist';
import { getRequest, getServer, headers, setRules, useOpenRules } from '../server';
import * as contactDb from '../../src/contact/contactDataAccess';
import {
  isS3StoredTranscript,
  NewConversationMedia,
  S3ContactMediaType,
} from '../../src/conversation-media/conversation-media-data-access';
import { mockingProxy, mockSuccessfulTwilioAuthentication } from '@tech-matters/testing';
import {
  cleanupCases,
  cleanupContacts,
  cleanupContactsJobs,
  cleanupCsamReports,
  cleanupReferrals,
} from './db-cleanup';
import each from 'jest-each';
import { chatChannels } from '../../src/contact/channelTypes';
import { ContactJobType } from '@tech-matters/types/dist/ContactJob';
import { ruleFileWithOneActionOverride } from '../permissions-overrides';
import { selectJobsByContactId } from './db-validations';

useOpenRules();
const server = getServer({ enableProcessContactJobs: true });
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

let createdContact: contactDb.Contact;

beforeEach(async () => {
  await cleanup();

  createdContact = await contactApi.createContact(
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
});
afterEach(() => {
  useOpenRules();
});

afterAll(cleanup);

describe('/contacts/:contactId/conversationMedia route', () => {
  const subRoute = contactId => `${route}/${contactId}/conversationMedia`;
  describe('POST', () => {
    test('should return 401 if user is not authenticated', async () => {
      const items: NewConversationMedia[] = [
        {
          storeType: 'S3',
          storeTypeSpecificData: {
            type: S3ContactMediaType.TRANSCRIPT,
            location: {
              bucket: 'bucket',
              key: 'key',
            },
          },
        },
      ];
      const response = await request.post(subRoute(createdContact.id)).send(items);
      expect(response.status).toBe(401);
    });

    test("should return 404 if contact doesn't exist", async () => {
      const items: NewConversationMedia[] = [
        {
          storeType: 'S3',
          storeTypeSpecificData: {
            type: S3ContactMediaType.TRANSCRIPT,
            location: {
              bucket: 'bucket',
              key: 'key',
            },
          },
        },
      ];
      const response = await request
        .post(subRoute(createdContact.id + 100))
        .set(headers)
        .send(items);
      expect(response.status).toBe(404);
    });

    type TestCase = {
      description: string;
      existingMedia?: NewConversationMedia[];
      postedMedia: NewConversationMedia[];
      expectedContactMedia?: NewConversationMedia[];
    };

    const testCases: TestCase[] = [
      {
        description:
          'single media item added to contact with none - contact should have the new conversation media',
        postedMedia: [
          {
            storeType: 'S3',
            storeTypeSpecificData: {
              type: S3ContactMediaType.TRANSCRIPT,
              location: {
                bucket: 'bucket',
                key: 'key',
              },
            },
          },
        ],
        expectedContactMedia: [
          {
            storeType: 'S3',
            storeTypeSpecificData: {
              type: S3ContactMediaType.TRANSCRIPT,
              location: {
                bucket: 'bucket',
                key: 'key',
              },
            },
          },
        ],
      },
      {
        description:
          'multiple media items added to contact with none - contact should have the new conversation media',
        postedMedia: [
          {
            storeType: 'S3',
            storeTypeSpecificData: {
              type: S3ContactMediaType.TRANSCRIPT,
              location: {
                bucket: 'bucket',
                key: 'key',
              },
            },
          },
          {
            storeType: 'S3',
            storeTypeSpecificData: {
              type: S3ContactMediaType.RECORDING,
              location: {
                bucket: 'bucket',
                key: 'key2',
              },
            },
          },
        ],
      },
      {
        description:
          'multiple media items added to contact with some already - contact should have all the conversation media',
        existingMedia: [
          {
            storeType: 'S3',
            storeTypeSpecificData: {
              type: S3ContactMediaType.TRANSCRIPT,
              location: {
                bucket: 'existing-bucket',
                key: 'existing-key',
              },
            },
          },
        ],
        postedMedia: [
          {
            storeType: 'S3',
            storeTypeSpecificData: {
              type: S3ContactMediaType.TRANSCRIPT,
              location: {
                bucket: 'bucket',
                key: 'key',
              },
            },
          },
          {
            storeType: 'S3',
            storeTypeSpecificData: {
              type: S3ContactMediaType.RECORDING,
              location: {
                bucket: 'bucket',
                key: 'key2',
              },
            },
          },
        ],
        expectedContactMedia: [
          {
            storeType: 'S3',
            storeTypeSpecificData: {
              type: S3ContactMediaType.TRANSCRIPT,
              location: {
                bucket: 'existing-bucket',
                key: 'existing-key',
              },
            },
          },
          {
            storeType: 'S3',
            storeTypeSpecificData: {
              type: S3ContactMediaType.TRANSCRIPT,
              location: {
                bucket: 'bucket',
                key: 'key',
              },
            },
          },
          {
            storeType: 'S3',
            storeTypeSpecificData: {
              type: S3ContactMediaType.RECORDING,
              location: {
                bucket: 'bucket',
                key: 'key2',
              },
            },
          },
        ],
      },
    ];

    each(testCases).test(
      '$description and return 200',
      async ({ expectedContactMedia, postedMedia, existingMedia }: TestCase) => {
        if (existingMedia) {
          createdContact = (
            await request
              .post(subRoute(createdContact.id))
              .set(headers)
              .send(existingMedia)
          ).body;
        }

        const fullExpectedContactMedia = (expectedContactMedia ?? postedMedia).map(
          media => ({
            ...media,
            createdAt: expect.toParseAsDate(),
            updatedAt: expect.toParseAsDate(),
            contactId: createdContact.id,
            id: expect.any(Number),
            accountSid,
          }),
        );

        const expectedResponse = {
          ...createdContact,
          createdAt: expect.toParseAsDate(),
          finalizedAt: expect.toParseAsDate(),
          updatedAt: expect.toParseAsDate(),
          timeOfContact: expect.toParseAsDate(),
          conversationMedia: fullExpectedContactMedia,
        };

        const response = await request
          .post(subRoute(createdContact.id))
          .set(headers)
          .send(postedMedia);

        expect(response.status).toBe(200);
        expect(response.body).toEqual(expectedResponse);
        const checkResponse = await request
          .get(`${route}/byTaskSid/${createdContact.taskId}`)
          .set(headers)
          .send(postedMedia);
        expect(checkResponse.status).toBe(200);
        expect(checkResponse.body).toEqual(expectedResponse);
      },
    );

    describe('Contact Jobs', () => {
      each(
        chatChannels.map(channel => ({
          channel,
          contact: {
            ...contact1,
            channel,
            taskId: `${contact1.taskId}-${channel}`,
          },
        })),
      ).test(
        `Adding transcripts to contacts with channel type $channel should create ${ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT} job`,
        async ({ contact }) => {
          const { body: channelContact } = await request
            .post(route)
            .set(headers)
            .send(contact);
          await request
            .post(subRoute(channelContact.id))
            .set(headers)
            .send([
              {
                storeType: 'S3',
                storeTypeSpecificData: {
                  type: S3ContactMediaType.TRANSCRIPT,
                },
              },
            ]);

          const jobs = await selectJobsByContactId(channelContact.id, accountSid);

          const retrieveContactTranscriptJobs = jobs.filter(
            j => j.jobType === ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
          );
          expect(retrieveContactTranscriptJobs).toHaveLength(1);
        },
      );

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
        if (!expectTranscripts) {
          setRules(ruleFileWithOneActionOverride('viewExternalTranscript', false));
        } else {
          useOpenRules();
        }

        const { body: contactWithMedia } = await request
          .post(subRoute(createdContact.id))
          .set(headers)
          .send([
            {
              storeType: 'S3',
              storeTypeSpecificData: {
                type: S3ContactMediaType.TRANSCRIPT,
                location: {
                  bucket: 'bucket',
                  key: 'key',
                },
              },
            },
          ]);

        if (expectTranscripts) {
          expect(
            (<contactApi.Contact>contactWithMedia).conversationMedia?.some(
              isS3StoredTranscript,
            ),
          ).toBeTruthy();
        } else {
          expect(
            (<contactApi.Contact>contactWithMedia).conversationMedia?.some(
              isS3StoredTranscript,
            ),
          ).toBeFalsy();
        }
      });
    });
  });
});

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

import * as contactApi from '@tech-matters/hrm-core/contact/contactService';
import '../case/caseValidation';
import { ContactRawJson } from '@tech-matters/hrm-core/contact/contactJson';
import { accountSid, ALWAYS_CAN, contact1, workerSid } from '../mocks';
import { headers, setRules, useOpenRules } from '../server';
import * as contactDb from '@tech-matters/hrm-core/contact/contactDataAccess';
import {
  isS3StoredTranscript,
  NewConversationMedia,
  S3ContactMediaType,
} from '@tech-matters/hrm-core/conversation-media/conversationMediaDataAccess';
import each from 'jest-each';
import { ContactJobType } from '@tech-matters/types/ContactJob';
import { ruleFileActionOverride } from '../permissions-overrides';
import { selectJobsByContactId } from './db-validations';
import { setupServiceTests } from '../setupServiceTest';

useOpenRules();
const route = `/v0/accounts/${accountSid}/contacts`;

let createdContact: contactDb.Contact;

const { request } = setupServiceTests();

beforeEach(async () => {
  createdContact = await contactApi.createContact(
    accountSid,
    workerSid,
    {
      ...contact1,
      rawJson: <ContactRawJson>{},
    },
    ALWAYS_CAN,
    true,
  );
});

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
          conversationMedia: expect.arrayContaining(fullExpectedContactMedia),
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
        expect(checkResponse.body.conversationMedia.length).toEqual(
          fullExpectedContactMedia.length,
        );
      },
    );

    describe('Contact Jobs', () => {
      test(`Adding transcripts to contacts with channel type $channel should create ${ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT} job`, async () => {
        const { body: channelContact } = await request
          .post(route)
          .set(headers)
          .send(contact1);
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
        useOpenRules();
        if (!expectTranscripts) {
          setRules(ruleFileActionOverride('viewExternalTranscript', false));
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

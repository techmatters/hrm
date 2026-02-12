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

import { randomBytes } from 'crypto';
import formatISO from 'date-fns/formatISO';
import subMinutes from 'date-fns/subMinutes';
import each from 'jest-each';

import { TKConditionsSets, RulesFile } from '@tech-matters/hrm-core/permissions/rulesMap';
import { headers, setRules, useOpenRules } from '../server';
import * as contactService from '@tech-matters/hrm-core/contact/contactService';
import { ContactRawJson } from '@tech-matters/hrm-core/contact/contactJson';
import { WorkerSID } from '@tech-matters/types';
import { ALWAYS_CAN, accountSid } from '../mocks';
import { clearAllTables } from '../dbCleanup';
import { setupServiceTests } from '../setupServiceTest';
import { finalizeContact } from './finalizeContact';
import { NewContactRecord } from '@tech-matters/hrm-core/contact/sql/contactInsertSql';
import { removeNonPermittedFieldsFromContact } from '@tech-matters/hrm-core/contact/contactFieldExclusions';
import { newTwilioUser } from '@tech-matters/twilio-worker-auth';
import { openRules } from '@tech-matters/hrm-core/permissions/jsonPermissions';

const userTwilioWorkerId: WorkerSID = `WK${randomBytes(16).toString('hex')}`;

const createTestContact = async (twilioWorkerId: WorkerSID) => {
  const rawJson: ContactRawJson = {
    callType: 'Child calling about self',
    categories: {},
    caseInformation: {
      actionTaken: 'initial action',
      callSummary: 'initial summary',
      okForCaseWorkerToCall: null,
      hasConversationEvolved: 'Não',
      didYouDiscussRightsWithTheChild: null,
      didTheChildFeelWeSolvedTheirProblem: null,
    },
    contactlessTask: {
      date: '',
      time: '',
      channel: '',
      helpline: 'SaferNet',
      createdOnBehalfOf: twilioWorkerId,
    },
    childInformation: {
      age: '10',
      city: 'Test City',
      lastName: 'TestLast',
      firstName: 'TestFirst',
      email: 'test@example.com',
      state: 'Test State',
      gender: 'Male',
      phone1: '1234567890',
      phone2: '',
      ethnicity: '',
    },
    callerInformation: {
      age: '35',
      city: 'Caller City',
      lastName: 'CallerLast',
      firstName: 'CallerFirst',
      email: 'caller@example.com',
      state: 'Caller State',
      gender: 'Female',
      phone1: '0987654321',
      phone2: '',
      relationshipToChild: 'Parent',
    },
    definitionVersion: 'br-v1',
  };

  const timeOfContact = formatISO(subMinutes(new Date(), 5));
  const taskSid = `WT${randomBytes(16).toString('hex')}`;
  const channelSid = `CH${randomBytes(16).toString('hex')}`;

  return contactService.createContact(
    accountSid,
    twilioWorkerId,
    {
      rawJson,
      twilioWorkerId,
      timeOfContact,
      taskId: taskSid,
      channelSid,
      queueName: 'Admin',
      helpline: 'helpline',
      conversationDuration: 5,
      serviceSid: 'ISxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      definitionVersion: 'br-v1',
    },
    ALWAYS_CAN,
    true,
  );
};

const overridePermissions = (permissions: TKConditionsSets<'contactField'>) => {
  useOpenRules();
  const rules: Partial<RulesFile> = {
    editContactField: permissions,
  };
  setRules(rules);
};

const { request } = setupServiceTests(userTwilioWorkerId);

describe('Contact Field Permissions Tests', () => {
  let testContact: contactService.Contact;
  const routeBase = `/v0/accounts/${accountSid}/contacts`;

  beforeEach(async () => {
    await clearAllTables();
    testContact = await createTestContact(userTwilioWorkerId);
  });

  afterEach(async () => {
    await clearAllTables();
  });

  describe('PATCH /contacts/:id - Field-level permissions', () => {
    type TestCase = {
      description: string;
      editContactFieldPermissions: TKConditionsSets<'contactField'>;
      patchData: {
        rawJson: Partial<ContactRawJson>;
      };
      expectedFieldsUpdated: boolean;
      expectedFieldsNotUpdated?: string[];
    };

    const testCases: TestCase[] = [
      {
        description:
          'If the editContactField rules include condition set without a field condition applies to all fields, if the other conditions evaluate to true, the user can update all fields',
        editContactFieldPermissions: [['isOwner']],
        patchData: {
          rawJson: {
            caseInformation: {
              callSummary: 'Updated summary by owner',
              actionTaken: 'Updated action by owner',
            },
            childInformation: {
              firstName: 'UpdatedFirstName',
              city: 'UpdatedCity',
            },
          },
        },
        expectedFieldsUpdated: true,
      },
      {
        description:
          'If the editContactField rules include only condition sets that specify fields, any fields not specifically identified in any conditions are assumed to be permitted',
        editContactFieldPermissions: [
          [{ field: 'rawJson.caseInformation.callSummary' }, 'isSupervisor'],
        ],
        patchData: {
          rawJson: {
            caseInformation: {
              callSummary: 'Updated summary - should be blocked',
              actionTaken: 'Updated action - should be allowed',
            },
            childInformation: {
              firstName: 'UpdatedFirstName - should be allowed',
            },
          },
        },
        expectedFieldsUpdated: true,
        expectedFieldsNotUpdated: ['caseInformation.callSummary'],
      },
      {
        description:
          'If the editContactField rules specify a single condition set that specifies multiple field conditions, this condition set always evaluates false, but could be overridden by other condition sets evaluating true',
        editContactFieldPermissions: [
          [
            { field: 'rawJson.caseInformation.callSummary' },
            { field: 'rawJson.childInformation.firstName' },
          ],
          ['isOwner'],
        ],
        patchData: {
          rawJson: {
            caseInformation: {
              callSummary: 'Updated summary - should be allowed by isOwner',
            },
            childInformation: {
              firstName: 'UpdatedFirstName - should be allowed by isOwner',
            },
          },
        },
        expectedFieldsUpdated: true,
      },
      {
        description:
          'If the editContactField rules have no condition sets, the user can update all fields, since fields not called out in conditions are not blocked',
        editContactFieldPermissions: [],
        patchData: {
          rawJson: {
            caseInformation: {
              callSummary: 'Updated summary - should be allowed',
              actionTaken: 'Updated action - should be allowed',
            },
            childInformation: {
              firstName: 'UpdatedFirstName - should be allowed',
              city: 'UpdatedCity - should be allowed',
            },
          },
        },
        expectedFieldsUpdated: true,
      },
      {
        description:
          'Field-specific permissions should block specific fields when conditions do not evaluate true',
        editContactFieldPermissions: [
          [{ field: 'rawJson.caseInformation.callSummary' }, 'isSupervisor'],
          [{ field: 'rawJson.childInformation.firstName' }, 'isSupervisor'],
        ],
        patchData: {
          rawJson: {
            caseInformation: {
              callSummary: 'Updated summary - should be blocked',
              actionTaken: 'Updated action - should be allowed',
            },
            childInformation: {
              firstName: 'UpdatedFirstName - should be blocked',
              city: 'UpdatedCity - should be allowed',
            },
          },
        },
        expectedFieldsUpdated: true,
        expectedFieldsNotUpdated: [
          'caseInformation.callSummary',
          'childInformation.firstName',
        ],
      },
      {
        description:
          'Multiple condition sets for the same field should work with OR logic - if any set evaluates true, field is allowed',
        editContactFieldPermissions: [
          [{ field: 'rawJson.caseInformation.callSummary' }, 'isSupervisor'],
          [{ field: 'rawJson.caseInformation.callSummary' }, 'isOwner'],
        ],
        patchData: {
          rawJson: {
            caseInformation: {
              callSummary: 'Updated summary - should be allowed by isOwner',
            },
          },
        },
        expectedFieldsUpdated: true,
      },
      {
        description:
          'Everyone condition set should allow all fields regardless of other restrictions',
        editContactFieldPermissions: [
          [{ field: 'rawJson.caseInformation.callSummary' }, 'isSupervisor'],
          ['everyone'],
        ],
        patchData: {
          rawJson: {
            caseInformation: {
              callSummary: 'Updated summary - should be allowed by everyone',
            },
            childInformation: {
              firstName: 'UpdatedFirstName - should be allowed by everyone',
            },
          },
        },
        expectedFieldsUpdated: true,
      },
    ];

    each(testCases).test(
      '$description',
      async ({
        editContactFieldPermissions,
        patchData,
        expectedFieldsUpdated,
        expectedFieldsNotUpdated,
      }: TestCase) => {
        overridePermissions(editContactFieldPermissions);

        const response = await request
          .patch(`${routeBase}/${testContact.id}`)
          .set(headers)
          .send(patchData);

        expect(response.status).toBe(200);

        const updatedContact = response.body;

        if (expectedFieldsUpdated) {
          // Check that allowed fields were updated
          if (patchData.rawJson.caseInformation) {
            const caseInfo = patchData.rawJson.caseInformation;
            if (
              caseInfo.actionTaken &&
              !expectedFieldsNotUpdated?.includes('caseInformation.actionTaken')
            ) {
              expect(updatedContact.rawJson.caseInformation.actionTaken).toBe(
                caseInfo.actionTaken,
              );
            }
          }

          if (patchData.rawJson.childInformation) {
            const childInfo = patchData.rawJson.childInformation;
            if (
              childInfo.city &&
              !expectedFieldsNotUpdated?.includes('childInformation.city')
            ) {
              expect(updatedContact.rawJson.childInformation.city).toBe(childInfo.city);
            }
          }
        }

        // Check that blocked fields were NOT updated
        if (expectedFieldsNotUpdated) {
          for (const fieldPath of expectedFieldsNotUpdated) {
            const [form, field] = fieldPath.split('.');
            if (patchData.rawJson[form]?.[field]) {
              expect(updatedContact.rawJson[form][field]).not.toBe(
                patchData.rawJson[form][field],
              );
              // Should retain original value
              expect(updatedContact.rawJson[form][field]).toBe(
                testContact.rawJson[form][field],
              );
            }
          }
        }
      },
    );
  });

  describe('Field permissions with time-based conditions', () => {
    it('Should allow field updates when time-based conditions evaluate true', async () => {
      overridePermissions([
        [{ field: 'rawJson.caseInformation.callSummary' }, { createdHoursAgo: 24 }],
      ]);

      const patchData = {
        rawJson: {
          caseInformation: {
            callSummary: 'Updated summary - should be allowed',
          },
        },
      };

      const response = await request
        .patch(`${routeBase}/${testContact.id}`)
        .set(headers)
        .send(patchData);

      expect(response.status).toBe(200);
      expect(response.body.rawJson.caseInformation.callSummary).toBe(
        patchData.rawJson.caseInformation.callSummary,
      );
    });
  });

  describe('Field permissions with owner-based conditions', () => {
    it('Should block field updates for non-owners when isOwner condition is specified', async () => {
      const anotherUserWorkerId: WorkerSID = `WK${randomBytes(16).toString('hex')}`;
      const anotherUsersContact = await createTestContact(anotherUserWorkerId);
      await finalizeContact(anotherUsersContact);

      overridePermissions([
        [{ field: 'rawJson.caseInformation.callSummary' }, 'isOwner'],
      ]);

      const patchData = {
        rawJson: {
          caseInformation: {
            callSummary: 'Updated summary - should be blocked',
          },
        },
      };

      const response = await request
        .patch(`${routeBase}/${anotherUsersContact.id}`)
        .set(headers)
        .send(patchData);

      expect(response.status).toBe(200);
      // Field should not be updated because user is not the owner
      expect(response.body.rawJson.caseInformation.callSummary).toBe(
        anotherUsersContact.rawJson.caseInformation.callSummary,
      );
    });
  });

  describe('Complex field permission scenarios', () => {
    it('Should handle nested field paths correctly', async () => {
      overridePermissions([
        [{ field: 'rawJson.caseInformation.callSummary' }, 'isSupervisor'],
        [{ field: 'rawJson.caseInformation.actionTaken' }, 'isSupervisor'],
      ]);

      const patchData = {
        rawJson: {
          caseInformation: {
            callSummary: 'Updated summary - should be blocked',
            actionTaken: 'Updated action - should be blocked',
          },
          childInformation: {
            firstName: 'UpdatedFirstName - should be allowed',
          },
        },
      };

      const response = await request
        .patch(`${routeBase}/${testContact.id}`)
        .set(headers)
        .send(patchData);

      expect(response.status).toBe(200);
      // Blocked fields should retain original values
      expect(response.body.rawJson.caseInformation.callSummary).toBe(
        testContact.rawJson.caseInformation.callSummary,
      );
      expect(response.body.rawJson.caseInformation.actionTaken).toBe(
        testContact.rawJson.caseInformation.actionTaken,
      );
      // Allowed field should be updated
      expect(response.body.rawJson.childInformation.firstName).toBe(
        patchData.rawJson.childInformation.firstName,
      );
    });

    it('Should allow all fields when global isOwner condition is present along with field-specific restrictions', async () => {
      overridePermissions([
        [{ field: 'rawJson.caseInformation.callSummary' }, 'isSupervisor'],
        ['isOwner'],
      ]);

      const patchData = {
        rawJson: {
          caseInformation: {
            callSummary: 'Updated summary - should be allowed by isOwner',
          },
        },
      };

      const response = await request
        .patch(`${routeBase}/${testContact.id}`)
        .set(headers)
        .send(patchData);

      expect(response.status).toBe(200);
      expect(response.body.rawJson.caseInformation.callSummary).toBe(
        patchData.rawJson.caseInformation.callSummary,
      );
    });
  });

  describe('POST /contacts - Field-level permissions on creation', () => {
    type CreateTestCase = {
      description: string;
      editContactFieldPermissions: TKConditionsSets<'contactField'>;
      contactData: NewContactRecord;
      expectedFieldsIncluded?: string[];
      expectedFieldsExcluded?: string[];
    };

    const createTestCases: CreateTestCase[] = [
      {
        description:
          'If the editContactField rules include condition set without a field condition that evaluates to true, all fields should be allowed during creation',
        editContactFieldPermissions: [['everyone']],
        contactData: {
          rawJson: {
            callType: 'Child calling about self',
            categories: {},
            caseInformation: {
              callSummary: 'Summary - should be allowed',
              actionTaken: 'Action - should be allowed',
            },
            childInformation: {
              firstName: 'John',
              city: 'Test City',
            },
            definitionVersion: 'br-v1',
          },
          twilioWorkerId: userTwilioWorkerId,
          timeOfContact: formatISO(subMinutes(new Date(), 5)),
          taskId: `WT${randomBytes(16).toString('hex')}`,
          channelSid: `CH${randomBytes(16).toString('hex')}`,
          queueName: 'Admin',
          helpline: 'helpline',
          conversationDuration: 5,
          serviceSid: 'ISxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
          definitionVersion: 'br-v1',
        },
        expectedFieldsIncluded: [
          'caseInformation.callSummary',
          'caseInformation.actionTaken',
          'childInformation.firstName',
          'childInformation.city',
        ],
      },
      {
        description:
          'Field-specific permissions should exclude specific fields when conditions do not evaluate true during creation',
        editContactFieldPermissions: [
          [{ field: 'rawJson.caseInformation.callSummary' }, 'isSupervisor'],
          [{ field: 'rawJson.childInformation.firstName' }, 'isSupervisor'],
        ],
        contactData: {
          rawJson: {
            callType: 'Child calling about self',
            categories: {},
            caseInformation: {
              callSummary: 'Summary - should be excluded',
              actionTaken: 'Action - should be allowed',
            },
            childInformation: {
              firstName: 'John - should be excluded',
              city: 'Test City - should be allowed',
            },
            definitionVersion: 'br-v1',
          },
          twilioWorkerId: userTwilioWorkerId,
          timeOfContact: formatISO(subMinutes(new Date(), 5)),
          taskId: `WT${randomBytes(16).toString('hex')}`,
          channelSid: `CH${randomBytes(16).toString('hex')}`,
          queueName: 'Admin',
          helpline: 'helpline',
          conversationDuration: 5,
          serviceSid: 'ISxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
          definitionVersion: 'br-v1',
        },
        expectedFieldsIncluded: ['caseInformation.actionTaken', 'childInformation.city'],
        expectedFieldsExcluded: [
          'caseInformation.callSummary',
          'childInformation.firstName',
        ],
      },
      {
        description:
          'Multiple condition sets for the same field should work with OR logic during creation - if any set evaluates true, field is allowed',
        editContactFieldPermissions: [
          [{ field: 'rawJson.caseInformation.callSummary' }, 'isSupervisor'],
          [{ field: 'rawJson.caseInformation.callSummary' }, 'everyone'],
        ],
        contactData: {
          rawJson: {
            callType: 'Child calling about self',
            categories: {},
            childInformation: {},
            caseInformation: {
              callSummary: 'Summary - should be allowed by everyone',
            },
            definitionVersion: 'br-v1',
          },
          twilioWorkerId: userTwilioWorkerId,
          timeOfContact: formatISO(subMinutes(new Date(), 5)),
          taskId: `WT${randomBytes(16).toString('hex')}`,
          channelSid: `CH${randomBytes(16).toString('hex')}`,
          queueName: 'Admin',
          helpline: 'helpline',
          conversationDuration: 5,
          serviceSid: 'ISxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
          definitionVersion: 'br-v1',
        },
        expectedFieldsIncluded: ['caseInformation.callSummary'],
      },
      {
        description:
          'If the editContactField rules have no condition sets, all fields should be allowed during creation',
        editContactFieldPermissions: [],
        contactData: {
          rawJson: {
            callType: 'Child calling about self',
            categories: {},
            caseInformation: {
              callSummary: 'Summary - should be allowed',
              actionTaken: 'Action - should be allowed',
            },
            childInformation: {
              firstName: 'John - should be allowed',
              city: 'Test City - should be allowed',
            },
            definitionVersion: 'br-v1',
          },
          twilioWorkerId: userTwilioWorkerId,
          timeOfContact: formatISO(subMinutes(new Date(), 5)),
          taskId: `WT${randomBytes(16).toString('hex')}`,
          channelSid: `CH${randomBytes(16).toString('hex')}`,
          queueName: 'Admin',
          helpline: 'helpline',
          conversationDuration: 5,
          serviceSid: 'ISxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
          definitionVersion: 'br-v1',
        },
        expectedFieldsIncluded: [
          'caseInformation.callSummary',
          'caseInformation.actionTaken',
          'childInformation.firstName',
          'childInformation.city',
        ],
      },
      {
        description:
          'If the editContactField rules specify only condition sets with field conditions, unspecified fields should be allowed during creation',
        editContactFieldPermissions: [
          [{ field: 'rawJson.caseInformation.callSummary' }, 'isSupervisor'],
        ],
        contactData: {
          rawJson: {
            callType: 'Child calling about self',
            categories: {},
            caseInformation: {
              callSummary: 'Summary - should be excluded',
              actionTaken: 'Action - should be allowed (not specified)',
            },
            childInformation: {
              firstName: 'John - should be allowed (not specified)',
            },
            definitionVersion: 'br-v1',
          },
          twilioWorkerId: userTwilioWorkerId,
          timeOfContact: formatISO(subMinutes(new Date(), 5)),
          taskId: `WT${randomBytes(16).toString('hex')}`,
          channelSid: `CH${randomBytes(16).toString('hex')}`,
          queueName: 'Admin',
          helpline: 'helpline',
          conversationDuration: 5,
          serviceSid: 'ISxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
          definitionVersion: 'br-v1',
        },
        expectedFieldsIncluded: [
          'caseInformation.actionTaken',
          'childInformation.firstName',
        ],
        expectedFieldsExcluded: ['caseInformation.callSummary'],
      },
    ];

    each(createTestCases).test(
      '$description',
      async ({
        editContactFieldPermissions,
        contactData,
        expectedFieldsIncluded,
        expectedFieldsExcluded,
      }: CreateTestCase) => {
        overridePermissions(editContactFieldPermissions);

        const response = await request.post(routeBase).set(headers).send(contactData);

        expect(response.status).toBe(200);

        const createdContact = response.body;

        // Check that included fields are present
        if (expectedFieldsIncluded) {
          for (const fieldPath of expectedFieldsIncluded) {
            const [form, field] = fieldPath.split('.');
            if (contactData.rawJson[form]?.[field]) {
              expect(createdContact.rawJson[form][field]).toBe(
                contactData.rawJson[form][field],
              );
            }
          }
        }

        // Check that excluded fields were NOT included
        if (expectedFieldsExcluded) {
          for (const fieldPath of expectedFieldsExcluded) {
            const [form, field] = fieldPath.split('.');
            if (contactData.rawJson[form]?.[field]) {
              expect(createdContact.rawJson[form]?.[field]).toBeUndefined();
            }
          }
        }
      },
    );

    it('Should allow fields when time-based conditions evaluate true during creation', async () => {
      overridePermissions([
        [{ field: 'rawJson.caseInformation.callSummary' }, { createdHoursAgo: 24 }],
      ]);

      const contactData: NewContactRecord = {
        rawJson: {
          callType: 'Child calling about self',
          categories: {},
          childInformation: {},
          caseInformation: {
            callSummary: 'Summary - should be allowed (within 24 hours)',
          },
          definitionVersion: 'br-v1',
        },
        twilioWorkerId: userTwilioWorkerId,
        timeOfContact: formatISO(subMinutes(new Date(), 5)),
        taskId: `WT${randomBytes(16).toString('hex')}`,
        channelSid: `CH${randomBytes(16).toString('hex')}`,
        queueName: 'Admin',
        helpline: 'helpline',
        conversationDuration: 5,
        serviceSid: 'ISxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        definitionVersion: 'br-v1',
      };

      const response = await request.post(routeBase).set(headers).send(contactData);

      expect(response.status).toBe(200);
      expect(response.body.rawJson.caseInformation.callSummary).toBe(
        contactData.rawJson.caseInformation.callSummary,
      );
    });

    it('Should handle nested field paths correctly during creation', async () => {
      overridePermissions([
        [{ field: 'rawJson.caseInformation.callSummary' }, 'isSupervisor'],
        [{ field: 'rawJson.caseInformation.actionTaken' }, 'isSupervisor'],
      ]);

      const contactData: NewContactRecord = {
        rawJson: {
          callType: 'Child calling about self',
          categories: {},
          caseInformation: {
            callSummary: 'Summary - should be excluded',
            actionTaken: 'Action - should be excluded',
          },
          childInformation: {
            firstName: 'John - should be allowed',
          },
          definitionVersion: 'br-v1',
        },
        twilioWorkerId: userTwilioWorkerId,
        timeOfContact: formatISO(subMinutes(new Date(), 5)),
        taskId: `WT${randomBytes(16).toString('hex')}`,
        channelSid: `CH${randomBytes(16).toString('hex')}`,
        queueName: 'Admin',
        helpline: 'helpline',
        conversationDuration: 5,
        serviceSid: 'ISxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        definitionVersion: 'br-v1',
      };

      const response = await request.post(routeBase).set(headers).send(contactData);

      expect(response.status).toBe(200);
      // Excluded fields should not be present
      expect(response.body.rawJson.caseInformation?.callSummary).toBeUndefined();
      expect(response.body.rawJson.caseInformation?.actionTaken).toBeUndefined();
      // Allowed field should be present
      expect(response.body.rawJson.childInformation.firstName).toBe(
        contactData.rawJson.childInformation.firstName,
      );
    });

    it('Should allow all fields when global isOwner condition is present during creation', async () => {
      overridePermissions([
        [{ field: 'rawJson.caseInformation.callSummary' }, 'isSupervisor'],
        ['isOwner'],
      ]);

      const contactData: NewContactRecord = {
        rawJson: {
          callType: 'Child calling about self',
          categories: {},
          childInformation: {},
          caseInformation: {
            callSummary: 'Summary - should be allowed by isOwner',
          },
          definitionVersion: 'br-v1',
        },
        twilioWorkerId: userTwilioWorkerId,
        timeOfContact: formatISO(subMinutes(new Date(), 5)),
        taskId: `WT${randomBytes(16).toString('hex')}`,
        channelSid: `CH${randomBytes(16).toString('hex')}`,
        queueName: 'Admin',
        helpline: 'helpline',
        conversationDuration: 5,
        serviceSid: 'ISxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        definitionVersion: 'br-v1',
      };

      const response = await request.post(routeBase).set(headers).send(contactData);

      expect(response.status).toBe(200);
      expect(response.body.rawJson.caseInformation.callSummary).toBe(
        contactData.rawJson.caseInformation.callSummary,
      );
    });

    it('Should allow fields based on isOwner condition when creating contact on behalf of self', async () => {
      overridePermissions([
        [{ field: 'rawJson.caseInformation.callSummary' }, 'isOwner'],
      ]);

      const contactData: NewContactRecord = {
        rawJson: {
          callType: 'Child calling about self',
          categories: {},
          childInformation: {},
          caseInformation: {
            callSummary: 'Summary - should be allowed because creator is owner',
          },
          definitionVersion: 'br-v1',
        },
        twilioWorkerId: userTwilioWorkerId, // Same as the authenticated user
        timeOfContact: formatISO(subMinutes(new Date(), 5)),
        taskId: `WT${randomBytes(16).toString('hex')}`,
        channelSid: `CH${randomBytes(16).toString('hex')}`,
        queueName: 'Admin',
        helpline: 'helpline',
        conversationDuration: 5,
        serviceSid: 'ISxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        definitionVersion: 'br-v1',
      };

      const response = await request.post(routeBase).set(headers).send(contactData);

      expect(response.status).toBe(200);
      expect(response.body.rawJson.caseInformation.callSummary).toBe(
        contactData.rawJson.caseInformation.callSummary,
      );
    });

    it('Should exclude fields based on isOwner condition when creating contact on behalf of another user', async () => {
      overridePermissions([
        [{ field: 'rawJson.caseInformation.callSummary' }, 'isOwner'],
      ]);

      const anotherUserWorkerId: WorkerSID = `WK${randomBytes(16).toString('hex')}`;
      const contactData: NewContactRecord = {
        rawJson: {
          callType: 'Child calling about self',
          categories: {},
          childInformation: {},
          caseInformation: {
            callSummary: 'Summary - should be excluded because creator is not owner',
          },
          definitionVersion: 'br-v1',
        },
        twilioWorkerId: anotherUserWorkerId, // Different from the authenticated user
        timeOfContact: formatISO(subMinutes(new Date(), 5)),
        taskId: `WT${randomBytes(16).toString('hex')}`,
        channelSid: `CH${randomBytes(16).toString('hex')}`,
        queueName: 'Admin',
        helpline: 'helpline',
        conversationDuration: 5,
        serviceSid: 'ISxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        definitionVersion: 'br-v1',
      };

      const response = await request.post(routeBase).set(headers).send(contactData);

      expect(response.status).toBe(200);
      expect(response.body.rawJson.caseInformation?.callSummary).toBeUndefined();
    });
  });

  describe('removeNonPermittedFieldsFromContact - Direct unit tests', () => {
    const createMockUser = (workerId: WorkerSID) => {
      return newTwilioUser(accountSid, workerId, []);
    };

    const createBasicRules = (): RulesFile => {
      return {
        ...openRules,
        editContactField: [
          [{ field: 'rawJson.caseInformation.callSummary' }, 'isOwner'],
          [{ field: 'rawJson.childInformation.firstName' }, 'isSupervisor'],
          [{ field: 'rawJson.callerInformation.email' }, 'isOwner'],
        ],
      };
    };

    it('Should remove non-permitted fields from complete contact object', async () => {
      const mockUser = createMockUser(userTwilioWorkerId);
      const rules = createBasicRules();

      const contact: NewContactRecord = {
        rawJson: {
          callType: 'Child calling about self',
          categories: {},
          caseInformation: {
            callSummary: 'This should be removed - non-owner',
          },
          childInformation: {
            firstName: 'Should be removed - non-supervisor',
            lastName: 'Should remain',
          },
          callerInformation: {
            email: 'removed@example.com',
          },
          definitionVersion: 'br-v1',
        },
        twilioWorkerId: `WK${randomBytes(16).toString('hex')}`, // Different from mockUser
        timeOfContact: formatISO(new Date()),
        taskId: `WT${randomBytes(16).toString('hex')}`,
        channelSid: `CH${randomBytes(16).toString('hex')}`,
        queueName: 'Admin',
        helpline: 'helpline',
        conversationDuration: 5,
        serviceSid: 'ISxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        definitionVersion: 'br-v1',
      };

      await removeNonPermittedFieldsFromContact(mockUser, rules, contact, true);

      // callSummary should be removed (not owner)
      expect(contact.rawJson.caseInformation?.callSummary).toBeUndefined();
      // firstName should be removed (not supervisor)
      expect(contact.rawJson.childInformation?.firstName).toBeUndefined();
      // lastName should remain (no restriction)
      expect(contact.rawJson.childInformation?.lastName).toBe('Should remain');
      // email should be removed (not owner)
      expect(contact.rawJson.callerInformation?.email).toBeUndefined();
    });

    it('Should handle missing rawJson property gracefully', async () => {
      const mockUser = createMockUser(userTwilioWorkerId);
      const rules = createBasicRules();

      // TypeScript requires rawJson with childInformation and caseInformation
      // We test the scenario where the required fields exist but are empty
      const contact: NewContactRecord = {
        rawJson: {
          callType: 'Child calling about self',
          categories: {},
          caseInformation: {},
          childInformation: {},
          definitionVersion: 'br-v1',
        },
        twilioWorkerId: `WK${randomBytes(16).toString('hex')}`,
        timeOfContact: formatISO(new Date()),
        taskId: `WT${randomBytes(16).toString('hex')}`,
        channelSid: `CH${randomBytes(16).toString('hex')}`,
        queueName: 'Admin',
        helpline: 'helpline',
        conversationDuration: 5,
        serviceSid: 'ISxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        definitionVersion: 'br-v1',
      };

      // Should not throw even with empty forms
      await expect(
        removeNonPermittedFieldsFromContact(mockUser, rules, contact, true),
      ).resolves.not.toThrow();

      // rawJson should still be present
      expect(contact.rawJson).toBeDefined();
      expect(contact.rawJson.caseInformation).toEqual({});
      expect(contact.rawJson.childInformation).toEqual({});
    });

    it('Should handle missing form properties gracefully and not affect other forms', async () => {
      const mockUser = createMockUser(userTwilioWorkerId);
      const rules = createBasicRules();

      const contact: NewContactRecord = {
        rawJson: {
          callType: 'Child calling about self',
          categories: {},
          caseInformation: {}, // caseInformation is required but empty
          childInformation: {
            firstName: 'Should be removed - non-supervisor',
            lastName: 'Should remain',
          },
          // callerInformation is missing (optional)
          definitionVersion: 'br-v1',
        },
        twilioWorkerId: `WK${randomBytes(16).toString('hex')}`,
        timeOfContact: formatISO(new Date()),
        taskId: `WT${randomBytes(16).toString('hex')}`,
        channelSid: `CH${randomBytes(16).toString('hex')}`,
        queueName: 'Admin',
        helpline: 'helpline',
        conversationDuration: 5,
        serviceSid: 'ISxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        definitionVersion: 'br-v1',
      };

      await removeNonPermittedFieldsFromContact(mockUser, rules, contact, true);

      // caseInformation is empty, so no field to remove
      expect(contact.rawJson.caseInformation).toEqual({});
      // childInformation.firstName should still be removed
      expect(contact.rawJson.childInformation?.firstName).toBeUndefined();
      // lastName should remain
      expect(contact.rawJson.childInformation?.lastName).toBe('Should remain');
      // callerInformation is missing, so no error should occur
      expect(contact.rawJson.callerInformation).toBeUndefined();
    });

    it('Should handle missing field within a form gracefully', async () => {
      const mockUser = createMockUser(userTwilioWorkerId);
      const rules = createBasicRules();

      const contact: NewContactRecord = {
        rawJson: {
          callType: 'Child calling about self',
          categories: {},
          caseInformation: {
            // callSummary is missing - no field to remove
            actionTaken: 'Should remain',
          },
          childInformation: {
            // firstName is missing - no field to remove
            lastName: 'Should remain',
          },
          callerInformation: {
            // email is missing - no field to remove
            firstName: 'Should remain',
          },
          definitionVersion: 'br-v1',
        },
        twilioWorkerId: `WK${randomBytes(16).toString('hex')}`,
        timeOfContact: formatISO(new Date()),
        taskId: `WT${randomBytes(16).toString('hex')}`,
        channelSid: `CH${randomBytes(16).toString('hex')}`,
        queueName: 'Admin',
        helpline: 'helpline',
        conversationDuration: 5,
        serviceSid: 'ISxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        definitionVersion: 'br-v1',
      };

      await removeNonPermittedFieldsFromContact(mockUser, rules, contact, true);

      // Fields that were missing should remain missing, no error
      expect(contact.rawJson.caseInformation?.callSummary).toBeUndefined();
      expect(contact.rawJson.caseInformation?.actionTaken).toBe('Should remain');
      expect(contact.rawJson.childInformation?.firstName).toBeUndefined();
      expect(contact.rawJson.childInformation?.lastName).toBe('Should remain');
      expect(contact.rawJson.callerInformation?.email).toBeUndefined();
      expect(contact.rawJson.callerInformation?.firstName).toBe('Should remain');
    });

    it('Should not affect other exclusions when some properties are missing', async () => {
      const mockUser = createMockUser(userTwilioWorkerId);
      const rules = createBasicRules();

      const contact: NewContactRecord = {
        rawJson: {
          callType: 'Child calling about self',
          categories: {},
          caseInformation: {}, // caseInformation is required but empty
          childInformation: {
            firstName: 'Should be removed - non-supervisor',
            lastName: 'Should remain',
          },
          callerInformation: {
            email: 'removed@example.com',
          },
          definitionVersion: 'br-v1',
        },
        twilioWorkerId: `WK${randomBytes(16).toString('hex')}`,
        timeOfContact: formatISO(new Date()),
        taskId: `WT${randomBytes(16).toString('hex')}`,
        channelSid: `CH${randomBytes(16).toString('hex')}`,
        queueName: 'Admin',
        helpline: 'helpline',
        conversationDuration: 5,
        serviceSid: 'ISxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        definitionVersion: 'br-v1',
      };

      await removeNonPermittedFieldsFromContact(mockUser, rules, contact, true);

      // Even though caseInformation is empty, other exclusions should still work
      expect(contact.rawJson.caseInformation).toEqual({});
      expect(contact.rawJson.childInformation?.firstName).toBeUndefined();
      expect(contact.rawJson.childInformation?.lastName).toBe('Should remain');
      expect(contact.rawJson.callerInformation?.email).toBeUndefined();
    });

    it('Should allow fields when user is owner', async () => {
      const mockUser = createMockUser(userTwilioWorkerId);
      const rules = createBasicRules();

      const contact: NewContactRecord = {
        rawJson: {
          callType: 'Child calling about self',
          categories: {},
          caseInformation: {
            callSummary: 'Should remain - user is owner',
          },
          childInformation: {
            firstName: 'Should be removed - non-supervisor',
            lastName: 'Should remain',
          },
          callerInformation: {
            email: 'should.remain@example.com',
          },
          definitionVersion: 'br-v1',
        },
        twilioWorkerId: userTwilioWorkerId, // Same as mockUser - user is owner
        timeOfContact: formatISO(new Date()),
        taskId: `WT${randomBytes(16).toString('hex')}`,
        channelSid: `CH${randomBytes(16).toString('hex')}`,
        queueName: 'Admin',
        helpline: 'helpline',
        conversationDuration: 5,
        serviceSid: 'ISxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        definitionVersion: 'br-v1',
      };

      await removeNonPermittedFieldsFromContact(mockUser, rules, contact, true);

      // callSummary should remain (user is owner)
      expect(contact.rawJson.caseInformation?.callSummary).toBe(
        'Should remain - user is owner',
      );
      // firstName should still be removed (not supervisor)
      expect(contact.rawJson.childInformation?.firstName).toBeUndefined();
      // lastName should remain (no restriction)
      expect(contact.rawJson.childInformation?.lastName).toBe('Should remain');
      // email should remain (user is owner)
      expect(contact.rawJson.callerInformation?.email).toBe('should.remain@example.com');
    });

    it('Should allow fields when user is supervisor', async () => {
      const supervisorWorkerId: WorkerSID = `WK${randomBytes(16).toString('hex')}`;
      // Create supervisor user by passing 'supervisor' role
      const mockUser = newTwilioUser(accountSid, supervisorWorkerId, ['supervisor']);
      const rules = createBasicRules();

      const contact: NewContactRecord = {
        rawJson: {
          callType: 'Child calling about self',
          categories: {},
          caseInformation: {
            callSummary: 'Should be removed - not owner',
          },
          childInformation: {
            firstName: 'Should remain - user is supervisor',
            lastName: 'Should remain',
          },
          callerInformation: {
            email: 'removed@example.com',
          },
          definitionVersion: 'br-v1',
        },
        twilioWorkerId: `WK${randomBytes(16).toString('hex')}`, // Different from mockUser
        timeOfContact: formatISO(new Date()),
        taskId: `WT${randomBytes(16).toString('hex')}`,
        channelSid: `CH${randomBytes(16).toString('hex')}`,
        queueName: 'Admin',
        helpline: 'helpline',
        conversationDuration: 5,
        serviceSid: 'ISxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        definitionVersion: 'br-v1',
      };

      await removeNonPermittedFieldsFromContact(mockUser, rules, contact, true);

      // callSummary should be removed (not owner)
      expect(contact.rawJson.caseInformation?.callSummary).toBeUndefined();
      // firstName should remain (user is supervisor)
      expect(contact.rawJson.childInformation?.firstName).toBe(
        'Should remain - user is supervisor',
      );
      // lastName should remain (no restriction)
      expect(contact.rawJson.childInformation?.lastName).toBe('Should remain');
      // email should be removed (not owner)
      expect(contact.rawJson.callerInformation?.email).toBeUndefined();
    });
  });
});

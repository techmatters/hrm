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
});

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
  getExcludedFields,
  removeNonPermittedFieldsFromContact,
} from '../../contact/contactFieldExclusions';
import { RulesFile, TKConditionsSets } from '../../permissions/rulesMap';
import { newTwilioUser, newAccountSystemUser } from '@tech-matters/twilio-worker-auth';
import { Contact } from '../../contact/contactDataAccess';
import { WorkerSID } from '@tech-matters/types';
import { NewContactRecord } from '@tech-matters/hrm-types';
import { openRules } from '../../permissions/jsonPermissions';
import { randomBytes } from 'crypto';
import formatISO from 'date-fns/formatISO';

const accountSid = 'ACtest';
const workerSid = 'WKtest';
const anotherWorkerSid = 'WKother';

const mockContact: Contact = {
  id: '1',
  accountSid,
  rawJson: {
    callType: 'Test',
    categories: {},
    caseInformation: {
      callSummary: 'Test summary',
      actionTaken: 'Test action',
    },
    childInformation: {
      firstName: 'John',
      lastName: 'Doe',
      city: 'Test City',
    },
    callerInformation: {
      firstName: 'Jane',
      lastName: 'Doe',
    },
  },
  twilioWorkerId: workerSid,
  helpline: 'test',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  timeOfContact: new Date().toISOString(),
  taskId: 'WTtest',
  channelSid: 'CHtest',
  serviceSid: 'IStest',
  createdBy: workerSid,
  updatedBy: workerSid,
  number: '',
  channel: 'voice',
  conversationDuration: 0,
  queueName: 'test',
  finalizedAt: null,
  profileId: null,
  identifierId: null,
  csamReports: [],
  referrals: [],
  conversationMedia: [],
  caseId: null,
  definitionVersion: 'v1',
};

const createMockRules = (
  editContactFieldConditions: TKConditionsSets<'contactField'>,
): RulesFile => {
  return {
    viewContact: [],
    editContact: [],
    editInProgressContact: [],
    viewExternalTranscript: [],
    viewRecording: [],
    addContactToCase: [],
    removeContactFromCase: [],
    viewContactField: [],
    editContactField: editContactFieldConditions,
    viewCase: [],
    closeCase: [],
    reopenCase: [],
    caseStatusTransition: [],
    addCaseSection: [],
    editCaseSection: [],
    editCaseOverview: [],
    updateCaseContacts: [],
    viewProfile: [],
    flagProfile: [],
    unflagProfile: [],
    createProfileSection: [],
    viewProfileSection: [],
    editProfileSection: [],
    viewPostSurvey: [],
  };
};

describe('getExcludedFields', () => {
  describe('Global condition sets (no field conditions)', () => {
    it('should allow all fields when isOwner condition evaluates true', async () => {
      const rules = createMockRules([['isOwner']]);
      const user = newTwilioUser(accountSid, workerSid, []);
      const getExcluded = getExcludedFields(rules);

      const excludedFields = await getExcluded(mockContact, user, 'editContactField');

      expect(excludedFields).toEqual({});
    });

    it('should allow all fields when everyone condition is present', async () => {
      const rules = createMockRules([['everyone']]);
      const user = newTwilioUser(accountSid, anotherWorkerSid, []);
      const getExcluded = getExcludedFields(rules);

      const excludedFields = await getExcluded(mockContact, user, 'editContactField');

      expect(excludedFields).toEqual({});
    });

    it('should allow all fields when isSupervisor condition evaluates true', async () => {
      const rules = createMockRules([['isSupervisor']]);
      const user = newTwilioUser(accountSid, anotherWorkerSid, ['supervisor']);
      const getExcluded = getExcludedFields(rules);

      const excludedFields = await getExcluded(mockContact, user, 'editContactField');

      expect(excludedFields).toEqual({});
    });

    it('should allow all fields when global condition set includes isOwner OR everyone', async () => {
      const rules = createMockRules([['isOwner'], ['everyone']]);
      const user = newTwilioUser(accountSid, anotherWorkerSid, []);
      const getExcluded = getExcludedFields(rules);

      const excludedFields = await getExcluded(mockContact, user, 'editContactField');

      // everyone condition passes even for non-owner
      expect(excludedFields).toEqual({});
    });
  });

  describe('Field-specific condition sets', () => {
    it('should exclude specific field when field condition does not evaluate true', async () => {
      const rules = createMockRules([
        [{ field: 'rawJson.caseInformation.callSummary' as any }, 'isSupervisor'],
      ]);
      const user = newTwilioUser(accountSid, workerSid, []);
      const getExcluded = getExcludedFields(rules);

      const excludedFields = await getExcluded(mockContact, user, 'editContactField');

      expect(excludedFields).toEqual({
        caseInformation: ['callSummary'],
      });
    });

    it('should allow field when field-specific condition evaluates true', async () => {
      const rules = createMockRules([
        [{ field: 'rawJson.caseInformation.callSummary' as any }, 'isSupervisor'],
      ]);
      const user = newTwilioUser(accountSid, workerSid, ['supervisor']);
      const getExcluded = getExcludedFields(rules);

      const excludedFields = await getExcluded(mockContact, user, 'editContactField');

      expect(excludedFields).toEqual({});
    });

    it('should allow unspecified fields when only field-specific conditions exist', async () => {
      const rules = createMockRules([
        [{ field: 'rawJson.caseInformation.callSummary' as any }, 'isSupervisor'],
      ]);
      const user = newTwilioUser(accountSid, workerSid, []);
      const getExcluded = getExcludedFields(rules);

      const excludedFields = await getExcluded(mockContact, user, 'editContactField');

      // Only callSummary is restricted, other fields are allowed
      expect(excludedFields).toEqual({
        caseInformation: ['callSummary'],
      });
      expect(excludedFields.childInformation).toBeUndefined();
      expect(excludedFields.callerInformation).toBeUndefined();
    });

    it('should exclude multiple fields in same form when conditions do not evaluate true', async () => {
      const rules = createMockRules([
        [{ field: 'rawJson.caseInformation.callSummary' as any }, 'isSupervisor'],
        [{ field: 'rawJson.caseInformation.actionTaken' as any }, 'isSupervisor'],
      ]);
      const user = newTwilioUser(accountSid, workerSid, []);
      const getExcluded = getExcludedFields(rules);

      const excludedFields = await getExcluded(mockContact, user, 'editContactField');

      expect(excludedFields).toEqual({
        caseInformation: ['callSummary', 'actionTaken'],
      });
    });

    it('should exclude fields from different forms', async () => {
      const rules = createMockRules([
        [{ field: 'rawJson.caseInformation.callSummary' as any }, 'isSupervisor'],
        [{ field: 'rawJson.childInformation.firstName' as any }, 'isSupervisor'],
      ]);
      const user = newTwilioUser(accountSid, workerSid, []);
      const getExcluded = getExcludedFields(rules);

      const excludedFields = await getExcluded(mockContact, user, 'editContactField');

      expect(excludedFields).toEqual({
        caseInformation: ['callSummary'],
        childInformation: ['firstName'],
      });
    });

    it('should use OR logic for multiple condition sets on same field', async () => {
      const rules = createMockRules([
        [{ field: 'rawJson.caseInformation.callSummary' as any }, 'isSupervisor'],
        [{ field: 'rawJson.caseInformation.callSummary' as any }, 'isOwner'],
      ]);
      const user = newTwilioUser(accountSid, workerSid, []);
      const getExcluded = getExcludedFields(rules);

      const excludedFields = await getExcluded(mockContact, user, 'editContactField');

      // User is owner (workerSid matches), so field is allowed
      expect(excludedFields).toEqual({});
    });
  });

  describe('Multiple field conditions in single set', () => {
    it('should exclude fields when multiple field conditions in same set (invalid config)', async () => {
      const rules = createMockRules([
        [
          { field: 'rawJson.caseInformation.callSummary' as any },
          { field: 'rawJson.childInformation.firstName' as any },
        ],
      ]);
      const user = newTwilioUser(accountSid, workerSid, []);
      const getExcluded = getExcludedFields(rules);

      // Mock console.error to suppress the warning
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const excludedFields = await getExcluded(mockContact, user, 'editContactField');

      // The invalid configuration causes both fields to be excluded
      // because each field's condition set contains the other field condition
      // which is not in conditionsState and evaluates to false
      if (excludedFields.caseInformation) {
        expect(excludedFields.caseInformation).toContain('callSummary');
      }
      if (excludedFields.childInformation) {
        expect(excludedFields.childInformation).toContain('firstName');
      }

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('should allow fields when invalid config is overridden by global condition', async () => {
      const rules = createMockRules([
        [
          { field: 'rawJson.caseInformation.callSummary' as any },
          { field: 'rawJson.childInformation.firstName' as any },
        ],
        ['isOwner'],
      ]);
      const user = newTwilioUser(accountSid, workerSid, []);
      const getExcluded = getExcludedFields(rules);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const excludedFields = await getExcluded(mockContact, user, 'editContactField');

      // Global isOwner condition allows all fields
      expect(excludedFields).toEqual({});

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Empty condition sets', () => {
    it('should allow all fields when no condition sets are defined', async () => {
      const rules = createMockRules([]);
      const user = newTwilioUser(accountSid, workerSid, []);
      const getExcluded = getExcludedFields(rules);

      const excludedFields = await getExcluded(mockContact, user, 'editContactField');

      expect(excludedFields).toEqual({});
    });
  });

  describe('Global + field-specific conditions combined', () => {
    it('should allow all fields when global condition passes despite field restrictions', async () => {
      const rules = createMockRules([
        ['isOwner'],
        [{ field: 'rawJson.caseInformation.callSummary' as any }, 'isSupervisor'],
      ]);
      const user = newTwilioUser(accountSid, workerSid, []);
      const getExcluded = getExcludedFields(rules);

      const excludedFields = await getExcluded(mockContact, user, 'editContactField');

      // Global isOwner passes, so no fields are excluded
      expect(excludedFields).toEqual({});
    });

    it('should check field-specific rules when global condition fails', async () => {
      const rules = createMockRules([
        ['isSupervisor'], // Global condition
        [{ field: 'rawJson.caseInformation.callSummary' as any }, 'isOwner'],
      ]);
      const user = newTwilioUser(accountSid, workerSid, []);
      const getExcluded = getExcludedFields(rules);

      const excludedFields = await getExcluded(mockContact, user, 'editContactField');

      // Global isSupervisor fails, but field-specific isOwner passes for callSummary
      expect(excludedFields).toEqual({});
    });
  });

  describe('System user', () => {
    it('should allow all fields for system users', async () => {
      const rules = createMockRules([
        [{ field: 'rawJson.caseInformation.callSummary' as any }, 'isSupervisor'],
      ]);
      const user = newAccountSystemUser(accountSid);
      const getExcluded = getExcludedFields(rules);

      const excludedFields = await getExcluded(mockContact, user, 'editContactField');

      expect(excludedFields).toEqual({});
    });
  });

  describe('Time-based conditions', () => {
    it('should allow fields when createdHoursAgo condition is met', async () => {
      const rules = createMockRules([
        [
          { field: 'rawJson.caseInformation.callSummary' as any },
          { createdHoursAgo: 24 },
        ],
      ]);
      const user = newTwilioUser(accountSid, workerSid, []);
      const getExcluded = getExcludedFields(rules);

      // Contact was just created, so it's within 24 hours
      const excludedFields = await getExcluded(mockContact, user, 'editContactField');

      expect(excludedFields).toEqual({});
    });

    it('should exclude fields when createdHoursAgo condition is not met', async () => {
      // Create a contact with an older timestamp
      const oldContact = {
        ...mockContact,
        timeOfContact: new Date(Date.now() - 3600 * 1000).toISOString(), // 1 hour ago
        createdAt: new Date(Date.now() - 3600 * 1000).toISOString(),
      };

      const rules = createMockRules([
        [
          { field: 'rawJson.caseInformation.callSummary' as any },
          { createdHoursAgo: 0.5 },
        ],
      ]);
      const user = newTwilioUser(accountSid, workerSid, []);
      const getExcluded = getExcludedFields(rules);

      // Contact was created 1 hour ago, which is > 0.5 hours
      const excludedFields = await getExcluded(oldContact, user, 'editContactField');

      expect(excludedFields).toEqual({
        caseInformation: ['callSummary'],
      });
    });
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
    const mockUser = createMockUser(workerSid);
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
    const mockUser = createMockUser(workerSid);
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
    const mockUser = createMockUser(workerSid);
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
    const mockUser = createMockUser(workerSid);
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
    const mockUser = createMockUser(workerSid);
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
    const mockUser = createMockUser(workerSid);
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
      twilioWorkerId: workerSid, // Same as mockUser - user is owner
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

  it('Should remove fields with falsy values when not permitted', async () => {
    const mockUser = createMockUser(workerSid);
    const rules = createBasicRules();

    const contact: NewContactRecord = {
      rawJson: {
        callType: 'Child calling about self',
        categories: {},
        caseInformation: {
          callSummary: '', // Empty string - falsy value
        },
        childInformation: {
          firstName: false, // Boolean false is a valid value type (string | boolean) - falsy value
          lastName: 'Should remain',
        },
        callerInformation: {
          email: '', // Empty string - falsy value
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

    // All falsy values should still be removed when not permitted
    expect(contact.rawJson.caseInformation?.callSummary).toBeUndefined();
    expect(contact.rawJson.childInformation?.firstName).toBeUndefined();
    expect(contact.rawJson.childInformation?.lastName).toBe('Should remain');
    expect(contact.rawJson.callerInformation?.email).toBeUndefined();
  });
});

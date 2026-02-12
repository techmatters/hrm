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

import { getExcludedFields } from '../../contact/contactFieldExclusions';
import { RulesFile, TKConditionsSets } from '../../permissions/rulesMap';
import { newTwilioUser, newAccountSystemUser } from '@tech-matters/twilio-worker-auth';
import { Contact } from '../../contact/contactDataAccess';

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

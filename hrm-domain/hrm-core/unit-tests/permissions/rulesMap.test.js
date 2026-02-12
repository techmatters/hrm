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
Object.defineProperty(exports, "__esModule", { value: true });
const rulesMap_1 = require("../../permissions/rulesMap");
test('Rules maps are all valid', () => {
    expect(() => (0, rulesMap_1.validRulesMap)()).not.toThrow();
});
describe('ContactFieldSpecificCondition validation', () => {
    describe('Valid field paths', () => {
        test('accepts valid field path with childInformation', () => {
            const condition = { field: 'rawJson.childInformation.firstName' };
            expect((0, rulesMap_1.isContactFieldSpecificCondition)(condition)).toBe(true);
        });
        test('accepts valid field path with callerInformation', () => {
            const condition = { field: 'rawJson.callerInformation.phoneNumber' };
            expect((0, rulesMap_1.isContactFieldSpecificCondition)(condition)).toBe(true);
        });
        test('accepts valid field path with caseInformation', () => {
            const condition = { field: 'rawJson.caseInformation.caseType' };
            expect((0, rulesMap_1.isContactFieldSpecificCondition)(condition)).toBe(true);
        });
        test('accepts valid field path with categories', () => {
            const condition = { field: 'rawJson.categories.category1' };
            expect((0, rulesMap_1.isContactFieldSpecificCondition)(condition)).toBe(true);
        });
        test('accepts valid field path with contactlessTask', () => {
            const condition = { field: 'rawJson.contactlessTask.taskName' };
            expect((0, rulesMap_1.isContactFieldSpecificCondition)(condition)).toBe(true);
        });
        test('accepts valid field path with nested fields', () => {
            const condition = { field: 'rawJson.childInformation.deeply.nested.field' };
            expect((0, rulesMap_1.isContactFieldSpecificCondition)(condition)).toBe(true);
        });
        test('accepts valid field path with definitionVersion', () => {
            const condition = { field: 'rawJson.definitionVersion.value' };
            expect((0, rulesMap_1.isContactFieldSpecificCondition)(condition)).toBe(true);
        });
        test('accepts valid field path with callType', () => {
            const condition = { field: 'rawJson.callType.value' };
            expect((0, rulesMap_1.isContactFieldSpecificCondition)(condition)).toBe(true);
        });
        test('accepts valid field path with hangUpBy', () => {
            const condition = { field: 'rawJson.hangUpBy.value' };
            expect((0, rulesMap_1.isContactFieldSpecificCondition)(condition)).toBe(true);
        });
        test('accepts valid field path with referrals', () => {
            const condition = { field: 'rawJson.referrals.value' };
            expect((0, rulesMap_1.isContactFieldSpecificCondition)(condition)).toBe(true);
        });
        test('accepts valid field path with llmSupportedEntries', () => {
            const condition = { field: 'rawJson.llmSupportedEntries.value' };
            expect((0, rulesMap_1.isContactFieldSpecificCondition)(condition)).toBe(true);
        });
    });
    describe('Invalid field paths', () => {
        test('rejects field path without rawJson prefix', () => {
            const condition = { field: 'childInformation.firstName' };
            expect((0, rulesMap_1.isContactFieldSpecificCondition)(condition)).toBe(false);
        });
        test('rejects field path with invalid ContactRawJson key', () => {
            const condition = { field: 'rawJson.invalidKey.field' };
            expect((0, rulesMap_1.isContactFieldSpecificCondition)(condition)).toBe(false);
        });
        test('rejects field path with only rawJson prefix', () => {
            const condition = { field: 'rawJson' };
            expect((0, rulesMap_1.isContactFieldSpecificCondition)(condition)).toBe(false);
        });
        test('rejects field path with rawJson and key but no field', () => {
            const condition = { field: 'rawJson.childInformation' };
            expect((0, rulesMap_1.isContactFieldSpecificCondition)(condition)).toBe(false);
        });
        test('rejects non-string field value', () => {
            const condition = { field: 123 };
            expect((0, rulesMap_1.isContactFieldSpecificCondition)(condition)).toBe(false);
        });
        test('rejects non-object condition', () => {
            const condition = 'isSupervisor';
            expect((0, rulesMap_1.isContactFieldSpecificCondition)(condition)).toBe(false);
        });
        test('rejects condition without field key', () => {
            const condition = { notField: 'rawJson.childInformation.firstName' };
            expect((0, rulesMap_1.isContactFieldSpecificCondition)(condition)).toBe(false);
        });
    });
});
describe('contactField condition set validation', () => {
    describe('Multiple field conditions in same condition set', () => {
        test('rejects condition set with 2 field conditions', () => {
            const conditionSet = [
                { field: 'rawJson.childInformation.field1' },
                { field: 'rawJson.childInformation.field2' },
                'isSupervisor',
            ];
            expect((0, rulesMap_1.validateContactFieldConditionsSet)(conditionSet)).toBe(false);
        });
        test('rejects condition set with multiple different field conditions', () => {
            const conditionSet = [
                { field: 'rawJson.childInformation.field1' },
                { field: 'rawJson.callerInformation.field2' },
            ];
            expect((0, rulesMap_1.validateContactFieldConditionsSet)(conditionSet)).toBe(false);
        });
        test('accepts condition set with single field condition', () => {
            const conditionSet = [{ field: 'rawJson.childInformation.field1' }, 'isSupervisor'];
            expect((0, rulesMap_1.validateContactFieldConditionsSet)(conditionSet)).toBe(true);
        });
        test('accepts condition set with no field conditions', () => {
            const conditionSet = ['isSupervisor', 'everyone'];
            expect((0, rulesMap_1.validateContactFieldConditionsSet)(conditionSet)).toBe(true);
        });
        test('accepts condition set with only field condition', () => {
            const conditionSet = [{ field: 'rawJson.childInformation.field1' }];
            expect((0, rulesMap_1.validateContactFieldConditionsSet)(conditionSet)).toBe(true);
        });
    });
    describe('Field conditions in different condition sets', () => {
        test('accepts different field conditions in separate condition sets', () => {
            const conditionsSets = [
                [{ field: 'rawJson.childInformation.field1' }, 'isSupervisor'],
                [{ field: 'rawJson.childInformation.field2' }, 'isSupervisor'],
            ];
            expect((0, rulesMap_1.validateContactFieldConditionsSets)(conditionsSets)).toBe(true);
        });
        test('accepts multiple condition sets each with different fields', () => {
            const conditionsSets = [
                [{ field: 'rawJson.childInformation.field1' }, 'isSupervisor'],
                [{ field: 'rawJson.callerInformation.field2' }, 'isOwner'],
                [{ field: 'rawJson.caseInformation.field3' }],
            ];
            expect((0, rulesMap_1.validateContactFieldConditionsSets)(conditionsSets)).toBe(true);
        });
        test('rejects if any condition set has multiple field conditions', () => {
            const conditionsSets = [
                [{ field: 'rawJson.childInformation.field1' }, 'isSupervisor'],
                [
                    { field: 'rawJson.childInformation.field2' },
                    { field: 'rawJson.childInformation.field3' },
                ],
            ];
            expect((0, rulesMap_1.validateContactFieldConditionsSets)(conditionsSets)).toBe(false);
        });
    });
    describe('Invalid field paths in condition sets', () => {
        test('rejects condition set with invalid field path', () => {
            const conditionSet = [{ field: 'rawJson.invalidKey.field1' }, 'isSupervisor'];
            expect((0, rulesMap_1.validateContactFieldConditionsSet)(conditionSet)).toBe(false);
        });
        test('rejects condition sets with any invalid field path', () => {
            const conditionsSets = [
                [{ field: 'rawJson.childInformation.field1' }, 'isSupervisor'],
                [{ field: 'rawJson.invalidKey.field2' }],
            ];
            expect((0, rulesMap_1.validateContactFieldConditionsSets)(conditionsSets)).toBe(false);
        });
        test('rejects condition set with malformed field path', () => {
            const conditionSet = [{ field: 'childInformation.field1' }, 'isSupervisor'];
            expect((0, rulesMap_1.validateContactFieldConditionsSet)(conditionSet)).toBe(false);
        });
        test('rejects condition set with incomplete field path', () => {
            const conditionSet = [{ field: 'rawJson.childInformation' }, 'isSupervisor'];
            expect((0, rulesMap_1.validateContactFieldConditionsSet)(conditionSet)).toBe(false);
        });
    });
});

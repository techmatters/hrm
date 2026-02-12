"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeNonPermittedFieldsFromContact = exports.getExcludedFields = void 0;
const conditionChecks_1 = require("../permissions/conditionChecks");
const rulesMap_1 = require("../permissions/rulesMap");
const initializeCanForRules_1 = require("../permissions/initializeCanForRules");
const getExcludedFields = (permissionRules) => async (contact, user, action) => {
    const generateConditionState = (conditionSets) => {
        const timeBasedConditions = conditionSets.flatMap(cs => cs.filter(rulesMap_1.isTimeBasedCondition));
        const ctx = { currentTimestamp: new Date() };
        const appliedTimeBasedConditions = (0, initializeCanForRules_1.applyTimeBasedConditions)(timeBasedConditions)(user, contact, ctx);
        return {
            isSupervisor: user.isSupervisor,
            isOwner: (0, conditionChecks_1.isContactOwner)(user, contact),
            everyone: true,
            ...appliedTimeBasedConditions,
        };
    };
    // System users have full access
    if (user.isSystemUser)
        return {};
    const conditionSetsByField = {};
    const globalConditionSets = [];
    // RulesFile type can't type each of its condition sets based do the action type :-(
    const conditionSets = permissionRules[action];
    for (const conditionSet of conditionSets) {
        const fieldConditions = conditionSet.filter(r => typeof r === 'object' &&
            typeof r.field === 'string');
        if (fieldConditions.length > 1) {
            console.error('Invalid permission configuration. Multiple field conditions in a single condition set are not valid. Bottom level condition sets have AND logic, having 2 fields here means a field being checked needs to be 2 different fields at the same time. This condition set will always evaluate false', 'action:', action, 'condition set: ', conditionSet);
        }
        else if (fieldConditions.length === 1) {
            const fieldCondition = fieldConditions[0];
            conditionSetsByField[fieldCondition.field] =
                conditionSetsByField[fieldCondition.field] || [];
            conditionSetsByField[fieldCondition.field].push(conditionSet.filter(r => fieldCondition !== r));
        }
        else {
            globalConditionSets.push(conditionSet);
        }
    }
    // If there is a global check that passes, no fields will be excluded
    // So we can just return an empty set
    if ((0, initializeCanForRules_1.checkConditionsSets)(generateConditionState(globalConditionSets), globalConditionSets)) {
        return {};
    }
    const excludedFields = {};
    for (const [field, fieldConditionSets] of Object.entries(conditionSetsByField)) {
        const conditionsState = generateConditionState(fieldConditionSets);
        if (!(0, initializeCanForRules_1.checkConditionsSets)(conditionsState, fieldConditionSets)) {
            const [, formName, fieldName] = field.split('.');
            excludedFields[formName] = excludedFields[formName] || [];
            excludedFields[formName].push(fieldName);
        }
    }
    return excludedFields;
};
exports.getExcludedFields = getExcludedFields;
const removeNonPermittedFieldsFromContact = async (user, permissionRules, contact, forWriting) => {
    // Filter out any fields in the forms that this user isn't permitted to update
    const writeExclusions = await (0, exports.getExcludedFields)(permissionRules)(contact, user, forWriting ? 'editContactField' : 'viewContactField');
    for (const [exclusionForm, exclusionFields] of Object.entries(writeExclusions)) {
        for (const exclusionField of exclusionFields) {
            if (contact.rawJson?.[exclusionForm]?.[exclusionField]) {
                delete contact.rawJson[exclusionForm][exclusionField];
            }
        }
    }
};
exports.removeNonPermittedFieldsFromContact = removeNonPermittedFieldsFromContact;

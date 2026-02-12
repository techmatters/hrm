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
exports.rulesMap = exports.validRulesMap = exports.isRulesFile = exports.validateContactFieldConditionsSets = exports.validateContactFieldConditionsSet = exports.isProfileSectionSpecificCondition = exports.isContactFieldSpecificCondition = exports.isTimeBasedCondition = void 0;
const openRules = require('../permission-rules/open.json');
const closedRules = require('../permission-rules/closed.json');
const demoRules = require('../permission-rules/demo.json');
const devRules = require('../permission-rules/dev.json');
const e2eRules = require('../permission-rules/e2e.json');
const brRules = require('../permission-rules/br.json');
const caRules = require('../permission-rules/ca.json');
const clhsRules = require('../permission-rules/clhs.json');
const clRules = require('../permission-rules/cl.json');
const coRules = require('../permission-rules/co.json');
const etRules = require('../permission-rules/et.json');
const eumcRules = require('../permission-rules/eumc.json');
const huRules = require('../permission-rules/hu.json');
const inRules = require('../permission-rules/in.json');
const jmRules = require('../permission-rules/jm.json');
const mtRules = require('../permission-rules/mt.json');
const mwRules = require('../permission-rules/mw.json');
const nzRules = require('../permission-rules/nz.json');
const nzbaRules = require('../permission-rules/nzba.json');
const phRules = require('../permission-rules/ph.json');
const sgRules = require('../permission-rules/sg.json');
const ukmhRules = require('../permission-rules/ukmh.json');
const uschRules = require('../permission-rules/usch.json');
const uscrRules = require('../permission-rules/uscr.json');
const usvcRules = require('../permission-rules/usvc.json');
const thRules = require('../permission-rules/th.json');
const tzRules = require('../permission-rules/tz.json');
const zaRules = require('../permission-rules/za.json');
const zmRules = require('../permission-rules/zm.json');
const zwRules = require('../permission-rules/zw.json');
const types_1 = require("@tech-matters/types");
const actions_1 = require("./actions");
const timeBasedConditions = ['createdHoursAgo', 'createdDaysAgo'];
const isTimeBasedCondition = (c) => {
    if (typeof c === 'object') {
        const [[cond, param]] = Object.entries(c);
        return timeBasedConditions.includes(cond) && typeof param === 'number';
    }
    return false;
};
exports.isTimeBasedCondition = isTimeBasedCondition;
const userBasedConditions = ['isSupervisor', 'everyone'];
const isUserBasedCondition = (c) => typeof c === 'string' && userBasedConditions.includes(c);
const contactSpecificConditions = ['isOwner'];
const isContactSpecificCondition = (c) => typeof c === 'string' && contactSpecificConditions.includes(c);
/**
 * Validates that a field string matches the format rawJson.<validKey>.<fieldPath>
 * where validKey is one of the keys in ContactRawJson type
 */
const isValidContactFieldPath = (field) => {
    const RAW_JSON_PREFIX = 'rawJson.';
    if (!field.startsWith(RAW_JSON_PREFIX)) {
        return false;
    }
    const pathWithoutPrefix = field.slice(RAW_JSON_PREFIX.length);
    const parts = pathWithoutPrefix.split('.');
    // Must have at least 2 parts: <ContactRawJsonKey>.<fieldPath>
    if (parts.length < 2) {
        return false;
    }
    // Valid keys from ContactRawJson type
    const validContactRawJsonKeys = [
        'definitionVersion',
        'callType',
        'childInformation',
        'callerInformation',
        'categories',
        'caseInformation',
        'contactlessTask',
        'llmSupportedEntries',
        'hangUpBy',
        'referrals',
    ];
    const contactRawJsonKey = parts[0];
    return validContactRawJsonKeys.includes(contactRawJsonKey);
};
const isContactFieldSpecificCondition = (c) => {
    if (typeof c === 'object') {
        const [[cond, param]] = Object.entries(c);
        return (cond === 'field' && typeof param === 'string' && isValidContactFieldPath(param));
    }
    return false;
};
exports.isContactFieldSpecificCondition = isContactFieldSpecificCondition;
const caseSpecificConditions = ['isCreator', 'isCaseOpen', 'isCaseContactOwner'];
const isCaseSpecificCondition = (c) => typeof c === 'string' && caseSpecificConditions.includes(c);
const isProfileSectionSpecificCondition = (c) => {
    if (typeof c === 'object') {
        const [[cond, param]] = Object.entries(c);
        return cond === 'sectionType' && typeof param === 'string';
    }
    return false;
};
exports.isProfileSectionSpecificCondition = isProfileSectionSpecificCondition;
const isSupportedContactCondition = (c) => (0, exports.isTimeBasedCondition)(c) || isUserBasedCondition(c) || isContactSpecificCondition(c);
const isSupportedContactFieldCondition = (c) => (0, exports.isTimeBasedCondition)(c) ||
    isUserBasedCondition(c) ||
    isContactSpecificCondition(c) ||
    (0, exports.isContactFieldSpecificCondition)(c);
const isSupportedCaseCondition = (c) => (0, exports.isTimeBasedCondition)(c) || isUserBasedCondition(c) || isCaseSpecificCondition(c);
const isSupportedProfileCondition = (c) => (0, exports.isTimeBasedCondition)(c) || isUserBasedCondition(c);
const isSupportedProfileSectionCondition = (c) => (0, exports.isTimeBasedCondition)(c) ||
    isUserBasedCondition(c) ||
    (0, exports.isProfileSectionSpecificCondition)(c);
const isSupportedPostSurveyCondition = (c) => (0, exports.isTimeBasedCondition)(c) || isUserBasedCondition(c);
const unsupportedActionConditions = {
    profileSection: {
        CREATE_PROFILE_SECTION: ['sectionType'],
    },
    contactField: {
        EDIT_CONTACT_FIELD: ['field'],
        VIEW_CONTACT_FIELD: ['field'],
    },
};
const isConditionSupported = (kind, actionName, condition) => {
    const unsupportedConditions = unsupportedActionConditions[kind]?.[actionName];
    if (!unsupportedConditions) {
        return true;
    }
    if (typeof condition === 'object') {
        return !Object.keys(condition).some(key => unsupportedConditions.includes(key));
    }
    return !unsupportedConditions.includes(condition);
};
const isTKCondition = (kind) => (c) => {
    if (!c) {
        return false;
    }
    switch (kind) {
        case 'contact': {
            return isSupportedContactCondition(c);
        }
        case 'contactField': {
            return isSupportedContactFieldCondition(c);
        }
        case 'case': {
            return isSupportedCaseCondition(c);
        }
        case 'profile': {
            return isSupportedProfileCondition(c);
        }
        case 'profileSection': {
            return isSupportedProfileSectionCondition(c);
        }
        case 'postSurvey': {
            return isSupportedPostSurveyCondition(c);
        }
        default: {
            (0, types_1.assertExhaustive)(kind);
        }
    }
};
const isTKConditionsSet = (kind) => (cs) => {
    if (!cs || !Array.isArray(cs) || !cs.every(isTKCondition(kind))) {
        return false;
    }
    // For contactField target kind, ensure condition set doesn't have multiple field conditions
    if (kind === 'contactField') {
        const fieldConditions = cs.filter(exports.isContactFieldSpecificCondition);
        if (fieldConditions.length > 1) {
            return false;
        }
    }
    return true;
};
const isTKConditionsSets = (kind) => (css) => css && Array.isArray(css) && css.every(isTKConditionsSet(kind));
// Export for testing
const validateContactFieldConditionsSet = (cs) => isTKConditionsSet('contactField')(cs);
exports.validateContactFieldConditionsSet = validateContactFieldConditionsSet;
const validateContactFieldConditionsSets = (css) => isTKConditionsSets('contactField')(css);
exports.validateContactFieldConditionsSets = validateContactFieldConditionsSets;
const isValidTKConditionsSets = (kind) => (css) => css ? css.every(cs => cs.every(isTKCondition(kind))) : false;
const isRulesFile = (rules) => Object.values(actions_1.actionsMaps).every(map => Object.values(map).every(action => isTKConditionsSets(rules[action])));
exports.isRulesFile = isRulesFile;
/**
 * Validates that for every TK, the ConditionsSets provided are valid
 * (i.e. present in supportedTKConditions)
 */
const validateTKActions = (rules) => Object.entries(actions_1.actionsMaps)
    .map(([kind, map]) => Object.entries(map).reduce((accum, [actionName, action]) => {
    return {
        ...accum,
        [action]: (0, actions_1.isTargetKind)(kind) &&
            isValidTKConditionsSets(kind)(rules[action]) &&
            rules[action]
                .flat()
                .every(condition => isConditionSupported(kind, actionName, condition)),
    };
}, {}))
    .reduce((accum, obj) => ({ ...accum, ...obj }), {});
const isValidTargetKindActions = (validated) => Object.values(validated).every(Boolean);
const rulesMapDef = {
    br: brRules,
    ca: caRules,
    clhs: clhsRules,
    cl: clRules,
    co: coRules,
    et: etRules,
    hu: huRules,
    in: inRules,
    jm: jmRules,
    mt: mtRules,
    mw: mwRules,
    nz: nzRules,
    nzba: nzbaRules,
    ph: phRules,
    sg: sgRules,
    th: thRules,
    tz: tzRules,
    ukmh: ukmhRules,
    usch: uschRules,
    uscr: uscrRules,
    usvc: usvcRules,
    za: zaRules,
    zm: zmRules,
    zw: zwRules,
    open: openRules,
    closed: closedRules,
    demo: demoRules,
    dev: devRules,
    e2e: e2eRules,
    eumc: eumcRules,
};
/**
 * For every entry of rulesMapDef, validates that every are valid RulesFile definitions,
 * and that the actions on each TK are provided with valid TKConditionsSets
 */
const validRulesMap = () => 
// This type assertion is legit as long as we check that every entry in rulesMapDef is indeed a RulesFile
Object.entries(rulesMapDef).reduce((accum, [k, rules]) => {
    if (!(0, exports.isRulesFile)(rules)) {
        throw new Error(`Error: rules file for ${k} is not a valid RulesFile`);
    }
    const validated = validateTKActions(rules);
    if (!isValidTargetKindActions(validated)) {
        const invalidActions = Object.entries(validated)
            .filter(([, val]) => !val)
            .map(([key]) => key);
        throw new Error(`Error: rules file for ${k} contains invalid actions mappings: ${JSON.stringify(invalidActions)}`);
    }
    return { ...accum, [k]: rules };
}, null);
exports.validRulesMap = validRulesMap;
exports.rulesMap = (0, exports.validRulesMap)();

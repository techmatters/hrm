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
exports.conversationMedia = exports.populatedCaseSections = exports.casePopulated = exports.case3 = exports.case2 = exports.case1 = exports.populateCaseSections = exports.ALWAYS_CAN = exports.workerSid = exports.withTaskId = exports.noHelpline = exports.another2 = exports.another1 = exports.anotherCaller = exports.anotherChild = exports.broken2 = exports.broken1 = exports.nonData2 = exports.nonData1 = exports.contact2 = exports.contact1 = exports.accountSid = void 0;
const caseService_1 = require("@tech-matters/hrm-core/case/caseService");
const conversationMedia_1 = require("@tech-matters/hrm-core/conversation-media/conversationMedia");
const twilio_worker_auth_1 = require("@tech-matters/twilio-worker-auth");
const caseSectionService_1 = require("@tech-matters/hrm-core/case/caseSection/caseSectionService");
const jsonPermissions_1 = require("@tech-matters/hrm-core/permissions/jsonPermissions");
exports.accountSid = 'ACCOUNT_SID';
exports.contact1 = {
    rawJson: {
        callType: 'Child calling about self',
        childInformation: {
            firstName: 'Jhonny',
            lastName: 'Theboy qwerty',
            gender: '',
            age: '',
            language: '',
            nationality: '',
            ethnicity: '',
            streetAddress: '',
            city: '',
            stateOrCounty: '',
            postalCode: '',
            phone1: '',
            phone2: '',
            refugee: false,
        },
        caseInformation: {
            callSummary: '',
            referredTo: '',
            status: '',
            keepConfidential: false,
            okForCaseWorkerToCall: false,
            howDidTheChildHearAboutUs: '',
            didYouDiscussRightsWithTheChild: false,
            didTheChildFeelWeSolvedTheirProblem: false,
            wouldTheChildRecommendUsToAFriend: false,
        },
        categories: {},
        callerInformation: {
            firstName: '',
            lastName: '',
            relationshipToChild: '',
            gender: '',
            age: '',
            language: '',
            nationality: '',
            ethnicity: '',
            city: '',
            phone1: '',
            phone2: '',
            postalCode: '',
            stateOrCounty: '',
            streetAddress: '',
        },
    },
    taskId: 'contact1-task-sid',
    twilioWorkerId: 'WK-worker-sid',
    createdBy: 'WK-worker-sid',
    helpline: '',
    queueName: '',
    number: '12025550184',
    channel: 'chat',
    conversationDuration: 14,
    profileId: undefined,
    identifierId: undefined,
    definitionVersion: 'as-v1',
};
exports.contact2 = {
    rawJson: {
        callType: 'Someone calling about a child',
        childInformation: {
            firstName: 'Name',
            lastName: 'Random',
            gender: '',
            age: '',
            language: '',
            nationality: '',
            ethnicity: '',
            streetAddress: '',
            city: '',
            stateOrCounty: '',
            postalCode: '',
            phone1: '',
            phone2: '',
            refugee: false,
        },
        caseInformation: {
            callSummary: '',
            referredTo: '',
            status: '',
            keepConfidential: false,
            okForCaseWorkerToCall: false,
            howDidTheChildHearAboutUs: '',
            didYouDiscussRightsWithTheChild: false,
            didTheChildFeelWeSolvedTheirProblem: false,
            wouldTheChildRecommendUsToAFriend: false,
        },
        categories: {},
        callerInformation: {
            firstName: 'Jhon qwerty',
            lastName: 'Thecaller',
            relationshipToChild: '',
            gender: '',
            age: '',
            language: '',
            nationality: '',
            ethnicity: '',
            city: '',
            phone1: '',
            phone2: '',
            postalCode: '',
            stateOrCounty: '',
            streetAddress: '',
        },
    },
    twilioWorkerId: 'WK-worker-sid',
    taskId: 'contact2-task-sid',
    createdBy: 'WK-worker-sid',
    helpline: '',
    queueName: '',
    number: '12025550184',
    channel: 'chat',
    conversationDuration: 10,
    profileId: undefined,
    identifierId: undefined,
    definitionVersion: 'as-v1',
};
exports.nonData1 = {
    ...exports.contact1,
    taskId: 'nonData1-task-sid',
    rawJson: {
        callType: 'Joke',
        childInformation: {},
        caseInformation: { callSummary: '' },
        categories: {},
        callerInformation: {},
    },
};
exports.nonData2 = {
    ...exports.contact2,
    taskId: 'nonData2-task-sid',
    rawJson: {
        callType: 'Blank',
        childInformation: {},
        caseInformation: { callSummary: '' },
        callerInformation: {},
        categories: {},
    },
};
// Non data contacts with actual information
exports.broken1 = {
    ...exports.contact1,
    taskId: 'broken1-task-sid',
    rawJson: { ...exports.contact1.rawJson, callType: 'Joke' },
};
exports.broken2 = {
    ...exports.contact2,
    taskId: 'broken2-task-sid',
    rawJson: { ...exports.contact2.rawJson, callType: 'Blank' },
};
exports.anotherChild = {
    ...exports.contact1.rawJson.childInformation,
    firstName: 'Marie',
    lastName: 'Curie',
};
exports.anotherCaller = {
    ...exports.contact2.rawJson.callerInformation,
    firstName: 'Marie',
    lastName: 'Curie',
};
exports.another1 = {
    ...exports.contact1,
    taskId: 'another1-task-sid',
    rawJson: { ...exports.contact1.rawJson, childInformation: exports.anotherChild },
    helpline: 'Helpline 1',
};
exports.another2 = {
    ...exports.contact2,
    taskId: 'another2-task-sid',
    rawJson: {
        ...exports.contact2.rawJson,
        callerInformation: {
            ...exports.anotherCaller,
            phone1: '+1 (515) 555-1212',
            phone2: '+1 (616) 555-1212',
        },
        childInformation: {
            ...exports.anotherChild,
            phone1: '(313) 555-1212',
            phone2: '+1 (414) 555-1212',
        },
    },
    helpline: 'Helpline 2',
    number: '+12125551212',
};
exports.noHelpline = {
    ...exports.another1,
    taskId: 'noHelpline-task-sid',
    helpline: '',
};
exports.withTaskId = {
    rawJson: {
        callType: 'Child calling about self',
        childInformation: {
            firstName: 'withTaskId',
            lastName: 'withTaskId',
            gender: '',
            age: '',
            language: '',
            nationality: '',
            ethnicity: '',
            streetAddress: '',
            city: '',
            stateOrCounty: '',
            postalCode: '',
            phone1: '',
            phone2: '',
            refugee: false,
        },
        categories: exports.contact1.rawJson.categories,
        callerInformation: exports.contact1.rawJson.callerInformation,
        caseInformation: exports.contact1.rawJson.caseInformation,
    },
    twilioWorkerId: 'WK-worker-sid',
    createdBy: 'WK-worker-sid',
    helpline: 'withTaskId',
    queueName: '',
    number: '11111111111',
    channel: 'chat',
    conversationDuration: 1,
    taskId: 'taskId',
    profileId: undefined,
    identifierId: undefined,
    definitionVersion: 'as-v1',
};
exports.workerSid = 'WK-worker-sid';
exports.ALWAYS_CAN = {
    user: (0, twilio_worker_auth_1.newTwilioUser)(exports.accountSid, exports.workerSid, []),
    can: () => true,
    permissionRules: jsonPermissions_1.openRules,
    permissionCheckContact: undefined,
};
const populateCaseSections = async (caseId, sectionsMap, caseAccountSid = exports.accountSid) => {
    const sectionsEntries = Object.entries(sectionsMap);
    for (const [sectionType, sections] of sectionsEntries) {
        for (const { section, workerSid: sectionWorkerSid } of sections) {
            await (0, caseSectionService_1.createCaseSection)(caseAccountSid, caseId, sectionType, section, sectionWorkerSid, true);
            // Ensure timestamps are in creation order & there are no collisions
            // eslint-disable-next-line @typescript-eslint/no-loop-func
            await new Promise(resolve => setTimeout(resolve, 10));
        }
    }
    return (0, caseService_1.getCase)(caseId, caseAccountSid, exports.ALWAYS_CAN);
};
exports.populateCaseSections = populateCaseSections;
exports.case1 = {
    status: 'open',
    helpline: 'helpline',
    info: {
        operatingArea: 'East',
    },
    twilioWorkerId: 'WK-worker-sid',
    createdBy: 'WK-worker-sid',
    accountSid: exports.accountSid,
    definitionVersion: 'as-v1',
};
exports.case2 = {
    status: 'open',
    helpline: 'helpline',
    info: {
        operatingArea: 'West',
        followUpDate: '2022-01-15T00:00:00.000Z',
    },
    twilioWorkerId: 'WK-worker-sid',
    createdBy: 'WK-worker-sid',
    accountSid: exports.accountSid,
    definitionVersion: 'as-v1',
};
exports.case3 = {
    ...exports.case1,
    info: {
        summary: 'something summery',
        followUpDate: '2005-03-15T00:00:00.000Z',
        operatingArea: 'North',
    },
};
exports.casePopulated = {
    ...exports.case1,
    info: {
        summary: 'something summery',
        followUpDate: '2005-03-15T00:00:00.000Z',
    },
};
exports.populatedCaseSections = {
    note: [
        {
            workerSid: 'WK-note-adder',
            section: {
                sectionId: '1',
                sectionTypeSpecificData: {
                    note: 'Child with covid-19',
                },
            },
        },
        {
            workerSid: 'WK-other-note-adder',
            section: {
                sectionId: '2',
                sectionTypeSpecificData: {
                    note: 'Child recovered from covid-19',
                },
            },
        },
    ],
    perpetrator: [
        {
            workerSid: 'WK-perpetrator-adder',
            section: {
                sectionTypeSpecificData: {
                    firstName: 'Jane',
                    lastName: 'Doe',
                },
            },
        },
        {
            workerSid: 'WK-perpetrator-adder',
            section: {
                sectionTypeSpecificData: {
                    firstName: 'J.',
                    lastName: 'Doe',
                    phone2: '+12345678',
                },
            },
        },
    ],
    household: [
        {
            workerSid: 'WK-household-adder',
            section: {
                sectionTypeSpecificData: {
                    firstName: 'Jane',
                    lastName: 'Doe',
                },
            },
        },
        {
            workerSid: 'WK-household-adder',
            section: {
                sectionTypeSpecificData: {
                    firstName: 'J.',
                    lastName: 'Doe',
                    phone2: '+12345678',
                },
            },
        },
    ],
    incident: [
        {
            workerSid: 'WK-incident-adder',
            section: {
                sectionTypeSpecificData: {
                    date: '2021-03-03',
                    duration: '',
                    location: 'Other',
                    isCaregiverAware: null,
                    incidentWitnessed: null,
                    reactionOfCaregiver: '',
                    whereElseBeenReported: '',
                    abuseReportedElsewhere: null,
                },
            },
        },
    ],
    referral: [
        {
            workerSid: 'WK-referral-adder',
            section: {
                sectionId: '2503',
                sectionTypeSpecificData: {
                    date: '2021-02-18',
                    comments: 'Referred to state agency',
                    referredTo: 'DREAMS',
                },
            },
        },
    ],
    document: [
        {
            workerSid: 'WK-document-adder',
            section: {
                sectionId: '5e127299-17ba-4adf-a040-69dac9ca45bf',
                sectionTypeSpecificData: {
                    comments: 'test file!',
                    fileName: 'sample1.pdf',
                },
            },
        },
        {
            workerSid: 'WK-document-adder',
            section: {
                sectionId: '10d21f35-142c-4538-92db-d558f80898ae',
                sectionTypeSpecificData: {
                    comments: '',
                    fileName: 'sample2.pdf',
                },
            },
        },
    ],
};
exports.conversationMedia = [
    {
        storeType: 'S3',
        storeTypeSpecificData: {
            type: conversationMedia_1.S3ContactMediaType.TRANSCRIPT,
            location: {
                bucket: 'mock-bucket',
                key: 'mockKey',
            },
        },
    },
];

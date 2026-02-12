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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ssm_cache_1 = require("@tech-matters/ssm-cache");
const SQSClient = __importStar(require("../../contact-job/client-sqs"));
const contactJobPublish = __importStar(require("../../contact-job/contact-job-publish"));
const types_1 = require("@tech-matters/types");
const jest_each_1 = __importDefault(require("jest-each"));
jest.mock('../../contact-job/client-sqs');
jest.mock('@tech-matters/ssm-cache', () => {
    return {
        getSsmParameter: jest.fn(),
    };
});
const accountSid = 'AC-accountSid';
const twilioWorkerId = 'WK-twilioWorkerId';
const mockGetSsmParameter = ssm_cache_1.getSsmParameter;
beforeEach(() => {
    jest.resetAllMocks();
    mockGetSsmParameter.mockResolvedValue('true');
});
describe('publishDueContactJobs', () => {
    test('Invalid job format throws but does not shuts down other jobs', async () => {
        const invalidPayload = { jobType: 'invalid' };
        const validPayload = {
            jobType: types_1.ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
            jobId: 1,
            accountSid,
            attemptNumber: 1,
            contactId: 123,
            conversationMediaId: 999,
            taskId: 'taskId',
            twilioWorkerId,
            serviceSid: 'serviceSid',
            channelSid: 'channelSid',
            filePath: 'filePath',
        };
        const errorSpy = jest.spyOn(console, 'error');
        const publishRetrieveContactTranscriptSpy = jest
            .spyOn(contactJobPublish, 'publishRetrieveContactTranscript')
            .mockImplementation(() => Promise.resolve(undefined));
        const result = await contactJobPublish.publishDueContactJobs([
            invalidPayload,
            validPayload,
        ]);
        expect(publishRetrieveContactTranscriptSpy).toHaveBeenCalledTimes(1);
        expect(publishRetrieveContactTranscriptSpy).toHaveBeenCalledWith(validPayload);
        expect(errorSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledWith(new Error(`Unhandled case: ${invalidPayload}`), invalidPayload);
        expect(result[0].status).toBe('rejected');
        expect(result[1].status).toBe('fulfilled');
        publishRetrieveContactTranscriptSpy.mockRestore();
    });
    test('If a job fails, it does not shuts down other jobs', async () => {
        const validPayload1 = {
            jobType: types_1.ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
            jobId: 1,
            accountSid,
            attemptNumber: 1,
            contactId: 123,
            taskId: 'taskId',
            twilioWorkerId,
            serviceSid: 'serviceSid',
            channelSid: 'channelSid',
            filePath: 'filePath',
        };
        const validPayload2 = {
            jobType: types_1.ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
            jobId: 2,
            accountSid,
            attemptNumber: 1,
            contactId: 321,
            taskId: 'taskId',
            twilioWorkerId,
            serviceSid: 'serviceSid',
            channelSid: 'channelSid',
            filePath: 'filePath',
        };
        const errorSpy = jest.spyOn(console, 'error');
        const publishRetrieveContactTranscriptSpy = jest
            .spyOn(contactJobPublish, 'publishRetrieveContactTranscript')
            .mockImplementation(() => Promise.resolve(undefined));
        publishRetrieveContactTranscriptSpy.mockImplementationOnce(() => {
            throw new Error(':sad_trombone:');
        });
        const result = await contactJobPublish.publishDueContactJobs([
            validPayload1,
            validPayload2,
        ]);
        expect(publishRetrieveContactTranscriptSpy).toHaveBeenCalledTimes(2);
        expect(publishRetrieveContactTranscriptSpy).toHaveBeenCalledWith(validPayload1);
        expect(publishRetrieveContactTranscriptSpy).toHaveBeenCalledWith(validPayload2);
        expect(errorSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledWith(new Error(':sad_trombone:'), validPayload1);
        expect(result[0].status).toBe('rejected');
        expect(result[1].status).toBe('fulfilled');
        publishRetrieveContactTranscriptSpy.mockRestore();
    });
    const dueJobsList = [
        {
            dueJob: {
                jobType: types_1.ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
                id: 1,
                completed: null,
                completionPayload: null,
                additionalPayload: {
                    conversationMediaId: 999,
                },
                accountSid,
                contactId: 123,
                lastAttempt: null,
                numberOfAttempts: 1,
                requested: new Date().toISOString(),
                resource: {
                    accountSid,
                    id: 123,
                    taskId: 'taskId',
                    twilioWorkerId,
                    serviceSid: 'serviceSid',
                    channelSid: 'channelSid',
                    createdAt: new Date('01-01-2022').toISOString(),
                    csamReports: [],
                },
            },
            publishDueContactJobFunction: 'publishRetrieveContactTranscript',
            expectedMessageToPublish: {
                jobType: types_1.ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
                jobId: 1,
                contactId: 123,
                conversationMediaId: 999,
                accountSid,
                channelSid: 'channelSid',
                serviceSid: 'serviceSid',
                taskId: 'taskId',
                twilioWorkerId,
                filePath: 'transcripts/2022/01/01/20220101000000-taskId.json',
                attemptNumber: 1,
            },
        },
        {
            dueJob: {
                jobType: types_1.ContactJobType.SCRUB_CONTACT_TRANSCRIPT,
                id: 1,
                completed: null,
                completionPayload: null,
                additionalPayload: {
                    originalLocation: {
                        bucket: 'bucket',
                        key: 'key',
                    },
                },
                accountSid,
                contactId: 123,
                lastAttempt: null,
                numberOfAttempts: 1,
                requested: new Date().toISOString(),
                resource: {
                    accountSid,
                    id: 123,
                    taskId: 'taskId',
                    twilioWorkerId,
                    serviceSid: 'serviceSid',
                    channelSid: 'channelSid',
                    createdAt: new Date('01-01-2022').toISOString(),
                    csamReports: [],
                },
            },
            publishDueContactJobFunction: 'publishScrubTranscriptJob',
            expectedMessageToPublish: {
                jobType: types_1.ContactJobType.SCRUB_CONTACT_TRANSCRIPT,
                jobId: 1,
                contactId: 123,
                originalLocation: {
                    bucket: 'bucket',
                    key: 'key',
                },
                accountSid,
                taskId: 'taskId',
                twilioWorkerId,
                attemptNumber: 1,
            },
        },
    ];
    test('Check that we are testing all the possible job types (useful for the next test)', () => {
        expect(dueJobsList.length).toBe(Object.values(types_1.ContactJobType).length);
        Object.values(types_1.ContactJobType).forEach(jobType => {
            expect(dueJobsList.some(({ dueJob }) => dueJob.jobType === jobType)).toBeTruthy();
        });
    });
    (0, jest_each_1.default)(dueJobsList).test('$dueJob.jobType job is processed accordingly and published via SNS client', async ({ dueJob, publishDueContactJobFunction, expectedMessageToPublish }) => {
        const publishToContactJobsTopicSpy = jest
            .spyOn(SQSClient, 'publishToContactJobs')
            .mockImplementation(() => Promise.resolve(undefined));
        const publishDueContactJobFunctionSpy = jest.spyOn(contactJobPublish, publishDueContactJobFunction);
        const result = await contactJobPublish.publishDueContactJobs([dueJob]);
        expect(publishDueContactJobFunctionSpy).toHaveBeenCalledWith(dueJob);
        expect(publishToContactJobsTopicSpy).toHaveBeenCalledWith(expectedMessageToPublish);
        expect(result[0].status).toBe('fulfilled');
    });
});

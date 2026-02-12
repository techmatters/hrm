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
const jest_each_1 = __importDefault(require("jest-each"));
const SQSClient = __importStar(require("../../contact-job/client-sqs"));
const contactJobDataAccess = __importStar(require("../../contact-job/contact-job-data-access"));
const contactJobComplete = __importStar(require("../../contact-job/contact-job-complete"));
const contact_job_error_1 = require("../../contact-job/contact-job-error");
const types_1 = require("@tech-matters/types");
const contact_job_processor_1 = require("../../contact-job/contact-job-processor");
jest.mock('../../contact-job/client-sqs');
jest.mock('../../contact-job/contact-job-data-access', () => {
    const mockJob = {
        id: 1,
        contactId: 123,
        accountSid: 'ACaccountSid',
        jobType: 'retrieve-transcript',
        requested: new Date(),
        completed: null,
        lastAttempt: new Date(),
        numberOfAttempts: 5,
        additionalPayload: null,
        completionPayload: null,
    };
    return {
        appendFailedAttemptPayload: jest.fn().mockResolvedValue(true),
        completeContactJob: jest.fn().mockResolvedValue(mockJob),
        getContactJobById: jest.fn().mockResolvedValue(mockJob),
    };
});
afterEach(() => {
    jest.clearAllMocks();
});
const accountSid = 'ACaccountSid';
const twilioWorkerId = 'WKtwilioWorkerId';
describe('pollAndProcessCompletedContactJobs', () => {
    test('Completed jobs are polled from SQS client as expected', async () => {
        const sqsSpy = jest
            .spyOn(SQSClient, 'pollCompletedContactJobsFromQueue')
            .mockImplementation(async () => ({
            $metadata: {},
            Messages: [],
        }));
        const result = await contactJobComplete.pollAndProcessCompletedContactJobs(contact_job_processor_1.JOB_MAX_ATTEMPTS);
        expect(sqsSpy).toHaveBeenCalled();
        expect(Array.isArray(result)).toBeTruthy();
        expect(result?.length).toBe(0);
    });
    test('Invalid job format throws but does not shuts down other jobs', async () => {
        const invalidPayload = {
            Body: JSON.stringify({
                jobType: 'invalid',
                attemptResult: types_1.ContactJobAttemptResult.SUCCESS,
            }),
            ReceiptHandle: 'invalid',
        };
        const valid1 = {
            jobType: types_1.ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
            jobId: 1,
            accountSid,
            attemptNumber: 1,
            contactId: 123,
            conversationMediaId: 999,
            taskId: 'taskId',
            twilioWorkerId: 'WKtwilioWorkerId',
            serviceSid: 'serviceSid',
            channelSid: 'channelSid',
            filePath: 'filePath',
            attemptResult: types_1.ContactJobAttemptResult.SUCCESS,
            attemptPayload: {
                bucket: 'some-url-here',
                key: 'some-url-here',
            },
        };
        const validPayload = {
            Body: JSON.stringify(valid1),
            ReceiptHandle: 'valid',
        };
        jest
            .spyOn(SQSClient, 'pollCompletedContactJobsFromQueue')
            .mockImplementation(async () => ({
            $metadata: {},
            Messages: [invalidPayload, validPayload],
        }));
        const errorSpy = jest.spyOn(console, 'error');
        const processCompletedRetrieveContactTranscriptSpy = jest
            .spyOn(contactJobComplete, 'processCompletedRetrieveContactTranscript')
            .mockImplementation(async () => { });
        jest
            .spyOn(contactJobDataAccess, 'completeContactJob')
            .mockImplementation(async () => 'done');
        const result = await contactJobComplete.pollAndProcessCompletedContactJobs(contact_job_processor_1.JOB_MAX_ATTEMPTS);
        expect(processCompletedRetrieveContactTranscriptSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledWith(new contact_job_error_1.ContactJobPollerError('Failed to process CompletedContactJobBody:'), invalidPayload, new Error(`Unhandled case: ${invalidPayload}`));
        expect(result?.[0].status).toBe('rejected');
        expect(result?.[1].status).toBe('fulfilled');
    });
    test('If a job fails, it does not shuts down other jobs', async () => {
        const valid1 = {
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
            attemptResult: types_1.ContactJobAttemptResult.SUCCESS,
            attemptPayload: {
                bucket: 'some-url-here',
                key: 'some-url-here',
            },
        };
        const validPayload1 = {
            Body: JSON.stringify(valid1),
            ReceiptHandle: 'valid',
        };
        const valid2 = { ...valid1, jobId: 2, contactId: 321 };
        const validPayload2 = {
            Body: JSON.stringify(valid2),
            ReceiptHandle: 'valid',
        };
        jest
            .spyOn(SQSClient, 'pollCompletedContactJobsFromQueue')
            .mockImplementation(async () => ({
            $metadata: {},
            Messages: [validPayload1, validPayload2],
        }));
        const errorSpy = jest.spyOn(console, 'error');
        const processCompletedRetrieveContactTranscriptSpy = jest
            .spyOn(contactJobComplete, 'processCompletedRetrieveContactTranscript')
            .mockImplementation(async () => { });
        processCompletedRetrieveContactTranscriptSpy.mockImplementationOnce(() => {
            throw new Error(':sad_trombone:');
        });
        jest
            .spyOn(contactJobDataAccess, 'completeContactJob')
            .mockImplementation(async () => 'done');
        const result = await contactJobComplete.pollAndProcessCompletedContactJobs(contact_job_processor_1.JOB_MAX_ATTEMPTS);
        expect(processCompletedRetrieveContactTranscriptSpy).toHaveBeenCalledTimes(2);
        expect(errorSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledWith(new contact_job_error_1.ContactJobPollerError('Failed to process CompletedContactJobBody:'), validPayload1, new Error(':sad_trombone:'));
        expect(result?.[0].status).toBe('rejected');
        expect(result?.[1].status).toBe('fulfilled');
    });
    const completedJobsList = [
        {
            job: {
                jobType: types_1.ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
                attemptResult: types_1.ContactJobAttemptResult.SUCCESS,
                jobId: 1,
                accountSid,
                contactId: 123,
                conversationMediaId: 999,
                taskId: 'taskId',
                twilioWorkerId,
                serviceSid: 'serviceSid',
                channelSid: 'channelSid',
                filePath: 'filePath',
                attemptNumber: 1,
                attemptPayload: {
                    bucket: 'completionPayload',
                    key: 'completionPayload',
                },
            },
            processCompletedFunction: 'processCompletedRetrieveContactTranscript',
        },
        {
            job: {
                jobType: types_1.ContactJobType.SCRUB_CONTACT_TRANSCRIPT,
                attemptResult: types_1.ContactJobAttemptResult.SUCCESS,
                jobId: 1,
                accountSid,
                contactId: 123,
                originalLocation: {
                    bucket: 'bucket',
                    key: 'key',
                },
                taskId: 'taskId',
                twilioWorkerId,
                attemptNumber: 1,
                attemptPayload: {
                    scrubbedLocation: {
                        bucket: 'scrubbed-bucket',
                        key: 'scrubbed-key',
                    },
                },
            },
            processCompletedFunction: 'processCompletedScrubContactTranscript',
        },
    ];
    test('Check that we are testing all the possible job types (useful for the next test)', () => {
        expect(completedJobsList.length).toBe(Object.values(types_1.ContactJobType).length);
        Object.values(types_1.ContactJobType).forEach(jobType => {
            expect(completedJobsList.some(({ job }) => job.jobType === jobType)).toBeTruthy();
        });
    });
    (0, jest_each_1.default)(completedJobsList).test('$job.jobType successful job is processed accordingly', async ({ job, processCompletedFunction }) => {
        const validPayload = {
            Body: JSON.stringify(job),
            ReceiptHandle: 'valid',
        };
        jest
            .spyOn(SQSClient, 'pollCompletedContactJobsFromQueue')
            .mockImplementation(async () => ({
            $metadata: {},
            Messages: [validPayload],
        }));
        const deletedCompletedContactJobsSpy = jest.spyOn(SQSClient, 'deleteCompletedContactJobsFromQueue');
        const processCompletedFunctionSpy = jest
            .spyOn(contactJobComplete, processCompletedFunction)
            .mockImplementation(async () => { });
        const completeContactJobSpy = jest
            .spyOn(contactJobDataAccess, 'completeContactJob')
            .mockImplementation(async () => validPayload);
        const result = await contactJobComplete.pollAndProcessCompletedContactJobs(contact_job_processor_1.JOB_MAX_ATTEMPTS);
        expect(processCompletedFunctionSpy).toHaveBeenCalledWith(job);
        expect(completeContactJobSpy).toHaveBeenCalledWith({
            id: job.jobId,
            completionPayload: {
                message: 'Job processed successfully',
                value: job.attemptPayload,
            },
        });
        expect(deletedCompletedContactJobsSpy).toHaveBeenCalledWith(validPayload.ReceiptHandle);
        expect(result?.[0].status).toBe('fulfilled');
    });
    const failedJobsList = [
        {
            job: {
                jobType: types_1.ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
                attemptResult: types_1.ContactJobAttemptResult.FAILURE,
                jobId: 1,
                accountSid,
                contactId: 123,
                conversationMediaId: 999,
                taskId: 'taskId',
                twilioWorkerId,
                serviceSid: 'serviceSid',
                channelSid: 'channelSid',
                filePath: 'filePath',
                attemptNumber: 1,
                attemptPayload: 'failed attemptPayload',
            },
            processCompletedFunction: 'processCompletedRetrieveContactTranscript',
            expectMarkedAsComplete: false,
        },
        {
            job: {
                jobType: types_1.ContactJobType.SCRUB_CONTACT_TRANSCRIPT,
                attemptResult: types_1.ContactJobAttemptResult.FAILURE,
                jobId: 1,
                accountSid,
                contactId: 123,
                originalLocation: {
                    bucket: 'bucket',
                    key: 'key',
                },
                taskId: 'taskId',
                twilioWorkerId,
                attemptNumber: 1,
                attemptPayload: 'failed attemptPayload',
            },
            processCompletedFunction: 'processCompletedRetrieveContactTranscript',
            expectMarkedAsComplete: false,
        },
    ];
    test('Check that we are testing all the possible job types (useful for the next test)', () => {
        expect(failedJobsList.length).toBe(Object.values(types_1.ContactJobType).length);
        Object.values(types_1.ContactJobType).forEach(jobType => {
            expect(failedJobsList.some(({ job }) => job.jobType === jobType)).toBeTruthy();
        });
    });
    (0, jest_each_1.default)(
    // Per each test case, add an identical one but that should be marked as complete
    failedJobsList.flatMap(testCase => [
        testCase,
        {
            ...testCase,
            job: { ...testCase.job, attemptNumber: contact_job_processor_1.JOB_MAX_ATTEMPTS },
            expectMarkedAsComplete: true,
        },
    ])).test('$job.jobType failed job is processed accordingly with expectMarkedAsComplete "$expectMarkedAsComplete"', async ({ job, processCompletedFunction, expectMarkedAsComplete }) => {
        const validPayload = {
            Body: JSON.stringify(job),
            ReceiptHandle: 'valid',
        };
        jest
            .spyOn(SQSClient, 'pollCompletedContactJobsFromQueue')
            .mockImplementation(async () => ({
            $metadata: {},
            Messages: [validPayload],
        }));
        const deletedCompletedContactJobsSpy = jest.spyOn(SQSClient, 'deleteCompletedContactJobsFromQueue');
        const processCompletedFunctionSpy = jest
            .spyOn(contactJobComplete, processCompletedFunction)
            .mockImplementation(async () => { });
        const completeContactJobSpy = jest
            .spyOn(contactJobDataAccess, 'completeContactJob')
            .mockImplementation(async () => job);
        const appendFailedAttemptPayloadSpy = jest
            .spyOn(contactJobDataAccess, 'appendFailedAttemptPayload')
            .mockImplementation(() => job);
        const result = await contactJobComplete.pollAndProcessCompletedContactJobs(contact_job_processor_1.JOB_MAX_ATTEMPTS);
        expect(processCompletedFunctionSpy).not.toHaveBeenCalled();
        expect(deletedCompletedContactJobsSpy).toHaveBeenCalledWith(validPayload.ReceiptHandle);
        if (expectMarkedAsComplete) {
            expect(completeContactJobSpy).toHaveBeenCalledWith({
                id: job.jobId,
                completionPayload: {
                    message: 'Attempts limit reached',
                },
                wasSuccessful: false,
            });
        }
        else {
            expect(completeContactJobSpy).not.toHaveBeenCalled();
        }
        expect(appendFailedAttemptPayloadSpy).toHaveBeenCalledWith(job.jobId, job.attemptNumber, job.attemptPayload);
        expect(result?.[0].status).toBe('fulfilled');
    });
    describe('getAttemptNumber', () => {
        it('returns completedJob.attemptNumber when not null', async () => {
            const completedJob = {
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
                attemptPayload: {
                    bucket: 'some-url-here',
                    key: 'some-url-here',
                },
                attemptResult: types_1.ContactJobAttemptResult.FAILURE,
            };
            const contactJob = {
                id: 1,
                contactId: 123,
                // conversationMediaId: 999,
                accountSid,
                jobType: types_1.ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
                requested: new Date().toISOString(),
                completed: null,
                lastAttempt: new Date().toISOString(),
                numberOfAttempts: 1,
                additionalPayload: null,
                completionPayload: null,
            };
            const result = contactJobComplete.getAttemptNumber(completedJob, contactJob);
            expect(result).toBe(completedJob.attemptNumber);
        });
        it('returns contactJob.numberOfAttempts when completedJob.attemptNumber is null', async () => {
            const completedJob = {
                jobType: types_1.ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
                jobId: 1,
                accountSid,
                attemptNumber: undefined,
                contactId: 123,
                conversationMediaId: 999,
                taskId: 'taskId',
                twilioWorkerId,
                serviceSid: 'serviceSid',
                channelSid: 'channelSid',
                filePath: 'filePath',
                attemptPayload: {
                    bucket: 'some-url-here',
                    key: 'some-url-here',
                },
                attemptResult: types_1.ContactJobAttemptResult.FAILURE,
            };
            const contactJob = {
                id: 1,
                contactId: 123,
                accountSid,
                jobType: types_1.ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
                requested: new Date().toISOString(),
                completed: null,
                lastAttempt: new Date().toISOString(),
                numberOfAttempts: 5,
                additionalPayload: null,
                completionPayload: null,
            };
            const result = await contactJobComplete.getAttemptNumber(completedJob, contactJob);
            expect(result).toBe(contactJob.numberOfAttempts);
        });
    });
});

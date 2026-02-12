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
exports.handler = void 0;
const job_errors_1 = require("@tech-matters/job-errors");
const processRecord = async (sqsRecord) => {
    try {
        console.dir(sqsRecord);
        // TODO: fill in the actual work!
    }
    catch (err) {
        console.error(new job_errors_1.ContactJobProcessorError('Failed to process record'), err);
    }
};
const handler = async (event) => {
    const response = { batchItemFailures: [] };
    try {
        const promises = event.Records.map(async (sqsRecord) => processRecord(sqsRecord));
        await Promise.all(promises);
        return response;
    }
    catch (err) {
        console.error(new job_errors_1.ContactJobProcessorError('Failed to init processor'), err);
        // We fail all messages here and rely on SQS retry/DLQ because we hit
        // a fatal error before we could process any of the messages. Once we
        // start using this lambda, we'll need to be sure the internal retry
        // logic is robust enough to handle transient errors.
        response.batchItemFailures = event.Records.map(record => {
            return {
                itemIdentifier: record.messageId,
            };
        });
        return response;
    }
};
exports.handler = handler;

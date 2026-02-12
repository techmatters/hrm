"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const job_errors_1 = require("@tech-matters/job-errors");
const types_1 = require("@tech-matters/types");
const messages_1 = require("./messages");
const messagesToPayloads_1 = require("./messagesToPayloads");
const payloadToIndex_1 = require("./payloadToIndex");
const handler = async (event) => {
    console.debug('Received event:', JSON.stringify(event, null, 2));
    try {
        // group the messages by accountSid while adding message meta
        const messagesByAccoundSid = (0, messages_1.groupMessagesByAccountSid)(event.Records);
        // generate corresponding IndexPayload for each IndexMessage and group them by target accountSid-indexType pair
        const payloadsByAccountSid = await (0, messagesToPayloads_1.messagesToPayloadsByAccountSid)(messagesByAccoundSid);
        console.debug('Mapped messages:', JSON.stringify(payloadsByAccountSid, null, 2));
        // index all the payloads
        const resultsByAccount = await (0, payloadToIndex_1.indexDocumentsByAccount)(payloadsByAccountSid);
        const documentsWithErrors = [];
        resultsByAccount.flat(2).forEach(resultItem => {
            const { result, indexType, accountSid, messageId } = resultItem;
            if ((0, types_1.isErr)(result)) {
                console.warn(`[generalised-search-${indexType}] ${result.error}. Account SID: ${accountSid}, Message ID: ${messageId}.`, result.message);
                documentsWithErrors.push(resultItem);
                return;
            }
            const { message } = messagesByAccoundSid[accountSid].find(m => m.messageId === messageId) ?? {};
            if (!message) {
                console.warn(`[generalised-search-${indexType}]: Result Message ID not found. Account SID: ${accountSid}, Result has Message ID: ${messageId} but this ID was not found in the original input messages.`);
                return;
            }
            switch (message.entityType) {
                case 'case': {
                    if (message.operation === 'delete') {
                        console.info(`[generalised-search-cases]: Indexing Request Acknowledged By ES. Account SID: ${accountSid}, Case ID: ${message.id}. Operation: ${message.operation}. (key: ${accountSid}/${message.id}/${message.operation})`);
                        return;
                    }
                    const caseObj = message.case;
                    console.info(`[generalised-search-cases]: Indexing Request Acknowledged By ES. Account SID: ${accountSid}, Case ID: ${caseObj.id}, Updated / Created At: ${caseObj.updatedAt ?? caseObj.createdAt}. Operation: ${message.operation}. (key: ${accountSid}/${caseObj.id}/${caseObj.updatedAt ?? caseObj.createdAt}/${message.operation})`);
                    return;
                }
                case 'contact': {
                    if (message.operation === 'delete') {
                        console.info(`[generalised-search-contacts]: Indexing Request Acknowledged By ES. Account SID: ${accountSid}, Contact ID: ${message.id}. Operation: ${message.operation}. (key: ${accountSid}/${message.id}/${message.operation})`);
                        return;
                    }
                    const { contact } = message;
                    console.info(`[generalised-search-contacts]: Indexing Request Acknowledged By ES. Account SID: ${accountSid}, Contact ID: ${contact.id}, Updated / Created At: ${contact.updatedAt ?? contact.createdAt}. Operation: ${message.operation}. (key: ${accountSid}/${contact.id}/${contact.updatedAt ?? contact.createdAt}/${message.operation})`);
                    return;
                }
            }
        });
        if (documentsWithErrors.length) {
            console.debug('Errors indexing documents', JSON.stringify(documentsWithErrors, null, 2));
        }
        // send the failed payloads back to SQS so they are redrive to DLQ
        const response = {
            batchItemFailures: documentsWithErrors.map(({ messageId }) => ({
                itemIdentifier: messageId,
            })),
        };
        return response;
    }
    catch (err) {
        console.error(new job_errors_1.HrmIndexProcessorError('Failed to process search index request'), err);
        const response = {
            batchItemFailures: event.Records.map(record => {
                return {
                    itemIdentifier: record.messageId,
                };
            }),
        };
        return response;
    }
};
exports.handler = handler;

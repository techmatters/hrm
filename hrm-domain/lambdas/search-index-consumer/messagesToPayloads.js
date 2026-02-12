"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.messagesToPayloadsByAccountSid = void 0;
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
const s3_client_1 = require("@tech-matters/s3-client");
const hrm_search_config_1 = require("@tech-matters/hrm-search-config");
const hrm_types_1 = require("@tech-matters/hrm-types");
const ssm_cache_1 = require("@tech-matters/ssm-cache");
const shouldIndexTranscripts = async (accountSid) => {
    try {
        const indexTranscriptParameterValue = await (0, ssm_cache_1.getSsmParameter)(`/${process.env.NODE_ENV}/hrm/${accountSid}/index_transcripts_for_search`);
        if (indexTranscriptParameterValue?.toLowerCase() === 'false') {
            return false;
        }
    }
    catch (e) {
        // Default when SSM parameter not present is true, continue
        if (!(e instanceof ssm_cache_1.SsmParameterNotFound)) {
            throw e;
        }
    }
    return true;
};
const contactIndexingInputData = async (m) => {
    let transcript = null;
    const { message: { contact, accountSid }, } = m;
    try {
        const transcriptEntry = contact.conversationMedia?.find(hrm_types_1.isS3StoredTranscript);
        if (transcriptEntry && (await shouldIndexTranscripts(accountSid))) {
            const { location } = transcriptEntry.storeTypeSpecificData;
            const { bucket, key } = location || {};
            if (bucket && key) {
                const transcriptString = await (0, s3_client_1.getS3Object)({ bucket, key });
                const parsedTranscript = JSON.parse(transcriptString);
                transcript = parsedTranscript.transcript.messages
                    .map(({ body }) => body)
                    .join('\n');
            }
        }
    }
    catch (err) {
        console.error(`Error trying to fetch transcript for contact #${contact.id}`, err);
    }
    return { ...m, transcript };
};
const caseIndexingInputData = async (m) => m;
const indexingInputDataMapper = async (m) => {
    const { message, messageId } = m;
    if (message.operation === 'delete') {
        switch (message.entityType) {
            case 'contact': {
                return { message, messageId };
            }
            case 'case': {
                return { message, messageId };
            }
        }
    }
    switch (message.entityType) {
        case 'contact': {
            return contactIndexingInputData({ message, messageId });
        }
        case 'case': {
            return caseIndexingInputData({ message, messageId });
        }
    }
};
const generatePayloadFromContact = (ps, m) => {
    switch (m.message.operation) {
        case 'create':
        case 'update':
        case 'reindex': {
            return {
                ...ps,
                // add an upsert job to HRM_CONTACTS_INDEX_TYPE index
                [hrm_search_config_1.HRM_CONTACTS_INDEX_TYPE]: [
                    ...(ps[hrm_search_config_1.HRM_CONTACTS_INDEX_TYPE] ?? []),
                    {
                        ...m,
                        documentId: parseInt(m.message.contact.id),
                        payload: { ...m.message, transcript: m.transcript },
                        indexHandler: 'updateDocument',
                    },
                ],
                // if associated to a case, add an upsert with script job to HRM_CASES_INDEX_TYPE index
                [hrm_search_config_1.HRM_CASES_INDEX_TYPE]: m.message.contact.caseId
                    ? [
                        ...(ps[hrm_search_config_1.HRM_CASES_INDEX_TYPE] ?? []),
                        {
                            ...m,
                            documentId: parseInt(m.message.contact.caseId),
                            payload: { ...m.message, transcript: m.transcript },
                            indexHandler: 'updateScript',
                        },
                    ]
                    : ps[hrm_search_config_1.HRM_CASES_INDEX_TYPE] ?? [],
            };
        }
        case 'delete': {
            // Compatibility with old messages that don't have a message.id field, can be removed once HRM v1.26.0 is deployed
            const contactId = m.message.id ?? m.message.contact?.id;
            return {
                ...ps,
                // add a delete job to HRM_CASES_INDEX_TYPE index
                [hrm_search_config_1.HRM_CONTACTS_INDEX_TYPE]: [
                    ...(ps[hrm_search_config_1.HRM_CONTACTS_INDEX_TYPE] ?? []),
                    {
                        ...m,
                        documentId: parseInt(contactId),
                        indexHandler: 'deleteDocument',
                    },
                ],
            };
        }
    }
};
const generatePayloadFromCase = (ps, m) => {
    switch (m.message.operation) {
        case 'create':
        case 'update':
        case 'reindex': {
            return {
                ...ps,
                // add an upsert job to HRM_CASES_INDEX_TYPE index
                [hrm_search_config_1.HRM_CASES_INDEX_TYPE]: [
                    ...(ps[hrm_search_config_1.HRM_CASES_INDEX_TYPE] ?? []),
                    {
                        ...m,
                        documentId: parseInt(m.message.case.id),
                        payload: { ...m.message },
                        indexHandler: 'updateDocument',
                    },
                ],
            };
        }
        case 'delete': {
            // Compatibility with old messages that don't have a message.id field, can be removed once HRM v1.26.0 is deployed
            const caseId = m.message.id ?? m.message.case?.id;
            if (!caseId) {
                throw new Error(`Case id not found in message ${m}`);
            }
            return {
                ...ps,
                // add a delete job to HRM_CASES_INDEX_TYPE index
                [hrm_search_config_1.HRM_CASES_INDEX_TYPE]: [
                    ...(ps[hrm_search_config_1.HRM_CASES_INDEX_TYPE] ?? []),
                    {
                        ...m,
                        documentId: parseInt(caseId),
                        indexHandler: 'deleteDocument',
                    },
                ],
            };
        }
    }
};
const messagesToPayloadReducer = (accum, currM) => {
    const { message, messageId } = currM;
    switch (message.entityType) {
        case 'contact': {
            const { transcript } = currM;
            return generatePayloadFromContact(accum, { message, messageId, transcript });
        }
        case 'case': {
            return generatePayloadFromCase(accum, { message, messageId });
        }
    }
};
const messagesToPayloadsByIndex = async (messages) => {
    const indexingInputData = await Promise.all(messages.map(indexingInputDataMapper));
    return indexingInputData.filter(Boolean).reduce(messagesToPayloadReducer, {});
};
const messagesToPayloadsByAccountSid = async (messages) => {
    const payloadsByAccountSidEntries = await Promise.all(Object.entries(messages).map(async ([accountSid, ms]) => {
        const payloads = await messagesToPayloadsByIndex(ms);
        return [accountSid, payloads];
    }));
    return Object.fromEntries(payloadsByAccountSidEntries);
};
exports.messagesToPayloadsByAccountSid = messagesToPayloadsByAccountSid;

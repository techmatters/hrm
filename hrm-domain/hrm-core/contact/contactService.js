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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateConversationMediaData = exports.generalisedContactSearch = exports.getContactsByProfileId = exports.addConversationMediaToContact = exports.connectContactToCase = exports.patchContact = exports.createContact = exports.getContactByTaskId = exports.getContactById = exports.bindApplyTransformations = exports.contactRecordToContact = void 0;
const types_1 = require("@tech-matters/types");
const elasticsearch_client_1 = require("@tech-matters/elasticsearch-client");
const hrm_search_config_1 = require("@tech-matters/hrm-search-config");
const contactDataAccess_1 = require("./contactDataAccess");
const search_1 = require("../search");
const permissions_1 = require("../permissions");
const twilio_worker_auth_1 = require("@tech-matters/twilio-worker-auth");
const referralService_1 = require("../referral/referralService");
const contact_job_1 = require("../contact-job/contact-job");
const conversationMedia_1 = require("../conversation-media/conversationMedia");
const profileService_1 = require("../profile/profileService");
const referralDataAccess_1 = require("../referral/referralDataAccess");
const sql_1 = require("../sql");
const entityChangeNotify_1 = require("../notifications/entityChangeNotify");
const contactSearchIndex_1 = require("./contactSearchIndex");
const dbConnection_1 = require("../dbConnection");
const contactFieldExclusions_1 = require("./contactFieldExclusions");
__exportStar(require("./contactJson"), exports);
const filterExternalTranscripts = (contact) => {
    const { conversationMedia, ...rest } = contact;
    const filteredConversationMedia = (conversationMedia ?? []).filter(m => !(0, conversationMedia_1.isS3StoredTranscript)(m));
    return {
        ...rest,
        conversationMedia: filteredConversationMedia,
    };
};
const permissionsBasedTransformations = [
    {
        action: permissions_1.actionsMaps.contact.VIEW_EXTERNAL_TRANSCRIPT,
        transformation: filterExternalTranscripts,
    },
];
const contactRecordToContact = (record) => {
    const { id, caseId, ...rest } = record;
    return {
        ...rest,
        id: record.id.toString(),
        ...(record.caseId ? { caseId: record.caseId.toString() } : {}),
    };
};
exports.contactRecordToContact = contactRecordToContact;
const bindApplyTransformations = (can, user) => (contact) => {
    return permissionsBasedTransformations.reduce((transformed, { action, transformation }) => !can(user, action, contact) ? transformation(transformed) : transformed, contact);
};
exports.bindApplyTransformations = bindApplyTransformations;
const getContactById = async (accountSid, contactId, { can, user }) => {
    console.info(`[Data Access Audit] ${accountSid}: Contact read by ${user.workerSid}, id: ${contactId}`);
    const contact = await (0, contactDataAccess_1.getById)(accountSid, parseInt(contactId));
    return contact
        ? (0, exports.bindApplyTransformations)(can, user)((0, exports.contactRecordToContact)(contact))
        : undefined;
};
exports.getContactById = getContactById;
const getContactByTaskId = async (accountSid, taskId, { can, user }) => {
    const contact = await (0, contactDataAccess_1.getByTaskSid)(accountSid, taskId);
    return contact
        ? (0, exports.bindApplyTransformations)(can, user)((0, exports.contactRecordToContact)(contact))
        : undefined;
};
exports.getContactByTaskId = getContactByTaskId;
const initProfile = async (conn, hrmAccountId, contact, definitionVersion) => {
    if (!contact.number)
        return (0, types_1.newOk)({ data: {} });
    const accountSid = (0, types_1.getTwilioAccountSidFromHrmAccountId)(hrmAccountId);
    const profileResult = await (0, profileService_1.getOrCreateProfileWithIdentifier)(conn)(hrmAccountId, {
        identifier: { identifier: contact.number },
        profile: { name: null, definitionVersion },
    }, { user: (0, twilio_worker_auth_1.newGlobalSystemUser)(accountSid) });
    if ((0, types_1.isErr)(profileResult)) {
        return profileResult;
    }
    return (0, types_1.newOkFromData)({
        profileId: profileResult.data?.identifier?.profiles?.[0].id,
        identifierId: profileResult.data?.identifier?.id,
    });
};
const doContactChangeNotification = (operation) => async ({ accountSid, contactId, }) => {
    try {
        const contact = await (0, contactDataAccess_1.getById)(accountSid, parseInt(contactId));
        if (contact) {
            await (0, entityChangeNotify_1.publishContactChangeNotification)({
                accountSid,
                contact: (0, exports.contactRecordToContact)(contact),
                operation,
            });
        }
    }
    catch (err) {
        console.error(`Error trying to index contact: accountSid ${accountSid} contactId ${contactId}`, err);
    }
};
const notifyContactCreate = doContactChangeNotification('create');
const notifyContactUpdate = doContactChangeNotification('update');
const notifyContactDelete = doContactChangeNotification('delete');
const isRemovedOfflineContact = (contact) => contact.taskId?.startsWith('offline-contact-task-') &&
    !contact.rawJson.callType &&
    !contact.finalizedAt;
// Creates a contact with all its related records within a single transaction
const createContact = async (accountSid, createdBy, newContact, { can, user, permissionRules, }, skipSearchIndex = false) => {
    let result;
    const db = await (0, dbConnection_1.getDbForAccount)(accountSid);
    for (let retries = 1; retries < 4; retries++) {
        result = await (0, types_1.ensureRejection)(db.tx)(async (conn) => {
            // TODO: this is compatibility code, remove rawJson.definitionVersion default once all clients use top level definition version
            const definitionVersion = newContact.definitionVersion || newContact.rawJson.definitionVersion;
            const res = await initProfile(conn, accountSid, newContact, definitionVersion);
            if ((0, types_1.isErr)(res)) {
                return res;
            }
            const { profileId, identifierId } = res.data;
            if (!definitionVersion) {
                return (0, types_1.newErr)({
                    error: 'InvalidParameterError',
                    message: 'createContact error: missing definition version parameter',
                });
            }
            const completeNewContact = {
                ...newContact,
                helpline: newContact.helpline ?? '',
                number: newContact.number ?? '',
                channel: newContact.channel ?? '',
                timeOfContact: (newContact.timeOfContact
                    ? new Date(newContact.timeOfContact)
                    : new Date()).toISOString(),
                channelSid: newContact.channelSid ?? '',
                serviceSid: newContact.serviceSid ?? '',
                taskId: newContact.taskId ?? '',
                twilioWorkerId: newContact.twilioWorkerId,
                rawJson: newContact.rawJson,
                queueName: newContact.queueName ?? '',
                createdBy,
                // Hardcoded to first profile for now, but will be updated to support multiple profiles
                profileId,
                identifierId,
                definitionVersion,
            };
            await (0, contactFieldExclusions_1.removeNonPermittedFieldsFromContact)(user, permissionRules, completeNewContact, true);
            const contactCreateResult = await (0, contactDataAccess_1.create)(conn)(accountSid, completeNewContact);
            if ((0, types_1.isErr)(contactCreateResult)) {
                return contactCreateResult;
            }
            // create contact record (may return an existing one cause idempotence)
            const { contact } = contactCreateResult.data;
            contact.referrals = [];
            contact.csamReports = [];
            contact.conversationMedia = [];
            const applyTransformations = (0, exports.bindApplyTransformations)(can, user);
            return (0, types_1.newOkFromData)(applyTransformations((0, exports.contactRecordToContact)(contact)));
        });
        if ((0, types_1.isOk)(result)) {
            // trigger index operation but don't await for it
            if (!skipSearchIndex) {
                await notifyContactCreate({ accountSid, contactId: result.data.id });
            }
            return result.data;
        }
        // This operation can fail with a unique constraint violation if a contact with the same ID is being created concurrently
        // It should only every need to retry once, but we'll do it 3 times just in case
        if ((0, sql_1.isDatabaseUniqueConstraintViolationErrorResult)(result) &&
            (result.constraint === 'Contacts_taskId_accountSid_idx' ||
                result.constraint === 'Identifiers_identifier_accountSid')) {
            if (retries === 1) {
                console.info(`Retrying createContact due to '${result.constraint}' data constraint conflict - it should use the existing resource next attempt (retry #${retries})`);
            }
            else {
                console.warn(`Retrying createContact due to '${result.constraint}' data constraint conflict  - it shouldn't have taken more than 1 retry to return the existing contact with this taskId but we are on retry #${retries} :-/`);
            }
        }
        else {
            return result.unwrap();
        }
    }
    return result.unwrap();
};
exports.createContact = createContact;
const patchContact = async (accountSid, updatedBy, finalize, contactId, { referrals, rawJson, definitionVersion, ...restOfPatch }, { can, user, permissionRules, permissionCheckContact, }, skipSearchIndex = false) => {
    const patched = await (await (0, dbConnection_1.getDbForAccount)(accountSid)).tx(async (conn) => {
        // if referrals are present, delete all existing and create new ones, otherwise leave them untouched
        // Explicitly specifying an empty array will delete all existing referrals
        if (referrals) {
            await (0, referralDataAccess_1.deleteContactReferrals)(conn)(accountSid, contactId);
            // Do this sequentially, it's on a single connection in a transaction anyway.
            for (const referral of referrals) {
                await (0, referralService_1.createReferral)(conn)(accountSid, {
                    ...referral,
                    contactId,
                });
            }
        }
        if (!definitionVersion) {
            const contact = permissionCheckContact ??
                (await (0, exports.getContactById)(accountSid, contactId, { can, user }));
            definitionVersion = contact.definitionVersion;
        }
        const res = await initProfile(conn, accountSid, restOfPatch, definitionVersion);
        if ((0, types_1.isErr)(res)) {
            throw res.rawError;
        }
        const { profileId, identifierId } = res.data;
        // No permissionCheckContact means it was accessed on an open endpoint - no excluded fields
        const excludedFields = permissionCheckContact
            ? await (0, contactFieldExclusions_1.getExcludedFields)(permissionRules)(permissionCheckContact, user, 'editContactField')
            : {};
        const updatedRecord = await (0, contactDataAccess_1.patch)(conn)(accountSid, contactId, finalize, {
            updatedBy,
            ...restOfPatch,
            ...rawJson,
            profileId,
            identifierId,
        }, excludedFields);
        if (!updatedRecord) {
            throw new Error(`Contact not found with id ${contactId}`);
        }
        const updated = (0, exports.contactRecordToContact)(updatedRecord);
        const applyTransformations = (0, exports.bindApplyTransformations)(can, user);
        // trigger index operation but don't await for it
        return applyTransformations(updated);
    });
    if (!skipSearchIndex) {
        if (isRemovedOfflineContact(patched)) {
            // If the task is an offline contact task and the call type is not set, this is a 'reset' contact, effectively deleted, so we should remove it from the index
            await notifyContactDelete({ accountSid, contactId });
        }
        else {
            await notifyContactUpdate({ accountSid, contactId });
        }
    }
    return patched;
};
exports.patchContact = patchContact;
const connectContactToCase = async (accountSid, contactId, caseId, { can, user }, skipSearchIndex = false) => {
    if (caseId === null) {
        // trigger remove operation, awaiting for it, since we'll lost the information of which is the "old case" otherwise
        await notifyContactDelete({ accountSid, contactId });
    }
    const updatedRecord = await (0, contactDataAccess_1.connectToCase)()(accountSid, contactId, caseId, user.workerSid);
    if (!updatedRecord) {
        throw new Error(`Contact not found with id ${contactId}`);
    }
    const updated = (0, exports.contactRecordToContact)(updatedRecord);
    const applyTransformations = (0, exports.bindApplyTransformations)(can, user);
    // trigger index operation but don't await for it
    if (!skipSearchIndex && !isRemovedOfflineContact(updated)) {
        await notifyContactUpdate({ accountSid, contactId });
    }
    return applyTransformations(updated);
};
exports.connectContactToCase = connectContactToCase;
const addConversationMediaToContact = async (accountSid, contactId, conversationMediaPayload, { can, user }, skipSearchIndex = false) => {
    const db = await (0, dbConnection_1.getDbForAccount)(accountSid);
    const contactRecord = await (0, contactDataAccess_1.getById)(accountSid, parseInt(contactId));
    if (!contactRecord) {
        throw new Error(`Target contact not found (id ${contactId})`);
    }
    const contact = (0, exports.contactRecordToContact)(contactRecord);
    return db.tx(async (conn) => {
        const createdConversationMedia = [];
        if (conversationMediaPayload && conversationMediaPayload.length) {
            for (const cm of conversationMediaPayload) {
                const conversationMedia = await (0, conversationMedia_1.createConversationMedia)(conn)(accountSid, {
                    contactId: parseInt(contactId),
                    ...cm,
                });
                createdConversationMedia.push(conversationMedia);
            }
        }
        // if pertinent, create retrieve-transcript job
        const pendingTranscript = createdConversationMedia.find(conversationMedia_1.isS3StoredTranscriptPending);
        if (pendingTranscript) {
            await (0, contact_job_1.createContactJob)(conn)({
                jobType: types_1.ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
                resource: contactRecord,
                additionalPayload: { conversationMediaId: pendingTranscript.id },
            });
        }
        const applyTransformations = (0, exports.bindApplyTransformations)(can, user);
        const updated = {
            ...contact,
            conversationMedia: [...contact.conversationMedia, ...createdConversationMedia],
        };
        // trigger index operation but don't await for it
        if (!skipSearchIndex) {
            await notifyContactUpdate({
                accountSid,
                contactId,
            });
        }
        return applyTransformations(updated);
    });
};
exports.addConversationMediaToContact = addConversationMediaToContact;
const generalizedSearchContacts = (searchQuery) => async (accountSid, searchParameters, query, { can, user, permissionRules, }) => {
    const applyTransformations = (0, exports.bindApplyTransformations)(can, user);
    const { limit, offset } = (0, search_1.getPaginationElements)(query);
    const unprocessedResults = await searchQuery(accountSid, searchParameters, limit, offset, user, permissionRules.viewContact);
    const contacts = unprocessedResults.rows.map(cr => applyTransformations((0, exports.contactRecordToContact)(cr)));
    return {
        count: unprocessedResults.count,
        contacts,
    };
};
const searchContactsByProfileId = generalizedSearchContacts(contactDataAccess_1.searchByProfileId);
const getContactsByProfileId = async (accountSid, profileId, query, ctx) => {
    try {
        const contacts = await searchContactsByProfileId(accountSid, { profileId }, query, ctx);
        return (0, types_1.newOkFromData)(contacts);
    }
    catch (err) {
        return (0, types_1.newErr)({
            message: err instanceof Error ? err.message : String(err),
            error: 'InternalServerError',
        });
    }
};
exports.getContactsByProfileId = getContactsByProfileId;
const searchContactsByIds = generalizedSearchContacts(contactDataAccess_1.searchByIds);
const generalisedContactSearch = async (accountSid, searchParameters, query, ctx) => {
    try {
        const { searchTerm, counselor, dateFrom, dateTo, onlyDataContacts } = searchParameters;
        const { limit, offset } = query;
        const pagination = {
            limit: parseInt(limit || '20', 10),
            start: parseInt(offset || '0', 10),
        };
        const searchFilters = (0, contactSearchIndex_1.generateContactSearchFilters)({
            counselor,
            dateFrom,
            dateTo,
            onlyDataContacts,
        });
        const permissionFilters = (0, contactSearchIndex_1.generateContactPermissionsFilters)({
            user: ctx.user,
            viewContact: ctx.permissionRules.viewContact,
            viewTranscript: ctx.permissionRules
                .viewExternalTranscript,
            buildParams: { parentPath: '' },
        });
        const client = (await (0, elasticsearch_client_1.getClient)({
            accountSid,
            indexType: hrm_search_config_1.HRM_CONTACTS_INDEX_TYPE,
            ssmConfigParameter: process.env.SSM_PARAM_ELASTICSEARCH_CONFIG,
        })).searchClient(hrm_search_config_1.hrmSearchConfiguration);
        const { total, items } = await client.search({
            searchParameters: {
                type: hrm_search_config_1.DocumentType.Contact,
                searchTerm,
                searchFilters,
                permissionFilters,
                pagination,
            },
        });
        const contactIds = items.map(item => parseInt(item.id, 10));
        const { contacts } = await searchContactsByIds(accountSid, { contactIds }, {}, // limit and offset are computed in ES query
        ctx);
        console.info(`[Data Access Audit] Account: ${accountSid}, User: ${ctx.user.workerSid}, Action: Contacts searched, contact ids: ${contactIds}`);
        // Monitors & dashboards use this log statement, review them before updating to ensure they remain aligned.
        console.info(`[generalised-search-contacts] AccountSid: ${accountSid} - Search Complete. Total count from ES: ${total}, Paginated count from ES: ${contactIds.length}, Paginated count from DB: ${contacts.length}.`);
        const order = contactIds.reduce((accum, idVal, idIndex) => ({ ...accum, [idVal]: idIndex }), {});
        const sorted = contacts.sort((a, b) => order[a.id] - order[b.id]);
        return (0, types_1.newOk)({ data: { count: total, contacts: sorted } });
    }
    catch (err) {
        return (0, types_1.newErr)({
            message: err instanceof Error ? err.message : String(err),
            error: 'InternalServerError',
        });
    }
};
exports.generalisedContactSearch = generalisedContactSearch;
/**
 * wrapper around updateSpecificData that also triggers a re-index operation when the conversation media gets updated (e.g. when transcript is exported)
 */
const updateConversationMediaData = (contactId, skipSearchIndex = false) => async (...[accountSid, id, storeTypeSpecificData]) => {
    const result = await (0, conversationMedia_1.updateConversationMediaSpecificData)(accountSid, id, storeTypeSpecificData);
    // trigger index operation but don't await for it
    if (!skipSearchIndex) {
        await notifyContactUpdate({ accountSid, contactId });
    }
    return result;
};
exports.updateConversationMediaData = updateConversationMediaData;

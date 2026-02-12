"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertToScriptUpdate = void 0;
const hrmIndexDocumentMappings_1 = require("./hrmIndexDocumentMappings");
const convertToIndexDocument_1 = require("./convertToIndexDocument");
const convertContactToCaseScriptUpdate = (payload) => {
    switch (payload.operation) {
        case 'create':
        case 'update':
        case 'reindex': {
            const { accountSid, caseId } = payload.contact;
            const contactDocument = (0, convertToIndexDocument_1.convertContactToContactDocument)(payload);
            const documentUpdate = {
                id: caseId.toString(),
                accountSid,
                contacts: [contactDocument],
            };
            const scriptUpdate = {
                source: `
          def replaceContact(Map newContact, Map _source) {
            if (_source.containsKey('contacts') && _source.contacts != null) {
              _source.contacts.removeIf(contact -> contact.id == newContact.id);
              _source.contacts.add(newContact);
            } else {
              _source.contacts = [newContact];
            }
          }

          replaceContact(params.newContact, ctx._source);
        `,
                params: {
                    newContact: contactDocument,
                },
            };
            return { documentUpdate, scriptUpdate };
        }
        case 'delete': {
            // Compatibility with old messages that don't have a message.id field, can be removed once HRM v1.26.0 is deployed
            const contactId = payload.id ?? payload.contact?.id;
            const scriptUpdate = {
                source: 'def removeContact(String contactId, List contacts) { contacts.removeIf(contact -> contact.id == contactId); } removeContact(params.contactId, ctx._source.contacts);',
                params: {
                    contactId: contactId.toString(),
                },
            };
            return { documentUpdate: {}, scriptUpdate };
        }
    }
};
const convertToCaseScriptUpdate = (payload) => {
    if (payload.entityType === 'contact') {
        return convertContactToCaseScriptUpdate(payload);
    }
    throw new Error(`convertToCaseScriptDocument not implemented for type ${payload.entityType} and operation ${payload.operation}`);
};
const convertToScriptUpdate = (payload, indexName) => {
    if (indexName.endsWith(hrmIndexDocumentMappings_1.HRM_CASES_INDEX_TYPE)) {
        return convertToCaseScriptUpdate(payload);
    }
    throw new Error(`convertToScriptDocument not implemented for index ${indexName}`);
};
exports.convertToScriptUpdate = convertToScriptUpdate;

import {
  connectToCase,
  Contact,
  create,
  patch,
  search,
  SearchParameters,
} from './contact-data-access';
import { ContactRawJson } from './contact-json';
import { retrieveCategories, getPaginationElements } from '../controllers/helpers';
import { NewContactRecord } from './sql/contact-insert-sql';

/**
 * @openapi
 * components:
 *   schemas:
 *     Contact:
 *       type: object
 *       required:
 *         - reservationId
 *         - rawJson
 *         - queueName
 *         - twilioWorkerId
 *         - helpline
 *         - number
 *         - channel
 *         - conversationDuration
 *         - caseId
 *         - timeOfContact
 *       properties:
 *         timestamp:
 *           type: integer
 *           format: int64
 *           example: 1565827981000
 *         reservationId:
 *           type: string
 *           example: WS17ce7c9cf654a4b240031ff7b17e7d93
 *         rawJson:
 *           type: object
 *           example:
 *             {
 *               'callType': {},
 *               'callerInformation': {},
 *               'childInformation': {},
 *               'caseInformation': {},
 *             }
 *         queueName:
 *           type: string
 *           example: Admin
 *         twilioWorkerId:
 *           type: string
 *           example: WZd3d289370720216aab7e3dc023e80f5f
 *         helpline:
 *           type: string
 *           example:
 *         number:
 *           type: string
 *           example: '+12025550163'
 *         channel:
 *           type: string
 *           example: web
 *         conversationDuration:
 *           type: integer
 *           format: int32
 *           example: 42
 *         caseId:
 *           type: integer
 *           format: int32
 *           example: 1
 *         accountSid:
 *           type: string
 *           example: ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
 *         timeOfContact:
 *           type: integer
 *           format: int64
 *           example: 1565827981000
 */

export type PatchPayload = {
  rawJson: Partial<
    Pick<ContactRawJson, 'callerInformation' | 'childInformation' | 'caseInformation'>
  >;
};

export type CSAMReportEntry = {
  csamReportId: string;
  id: number;
  createdAt: string;
  updatedAt?: string;
  updatedBy?: string;
  twilioWorkerId: string;
};

export type SearchContact = {
  contactId: string;
  overview: {
    helpline: string;
    dateTime: string;
    name: string;
    customerNumber: string;
    callType: string;
    categories: {};
    counselor: string;
    notes: string;
    channel: string;
    conversationDuration: number;
    createdBy: string;
    taskId: string;
  };
  details: ContactRawJson;
  csamReports: CSAMReportEntry[];
};

export type CreateContactPayloadWithFormProperty = Omit<NewContactRecord, 'rawJson'> & {
  form: ContactRawJson;
} & { csamReports?: CSAMReportEntry[] };

export type CreateContactPayload =
  | (NewContactRecord & { csamReports?: CSAMReportEntry[] })
  | CreateContactPayloadWithFormProperty;

export const usesFormProperty = (
  p: CreateContactPayload,
): p is CreateContactPayloadWithFormProperty => (<any>p).form && !(<any>p).rawJson;

export const createContact = async (
  accountSid: string,
  createdBy: string,
  newContact: CreateContactPayload,
): Promise<Contact> => {
  const rawJson = usesFormProperty(newContact) ? newContact.form : newContact.rawJson;
  const completeNewContact: NewContactRecord = {
    ...newContact,
    helpline: newContact.helpline ?? '',
    number: newContact.number ?? '',
    channel: newContact.channel ?? '',
    timeOfContact: newContact.timeOfContact ? new Date(newContact.timeOfContact) : new Date(),
    channelSid: newContact.channelSid ?? '',
    serviceSid: newContact.serviceSid ?? '',
    taskId: newContact.taskId ?? '',
    twilioWorkerId: newContact.twilioWorkerId ?? '',
    rawJson,
    queueName:
      // Checking in rawJson might be redundant, copied from Sequelize logic in contact-controller.js
      newContact.queueName || (<any>(rawJson ?? {})).queueName,
    createdBy,
  };
  return create(
    accountSid,
    completeNewContact,
    (newContact.csamReports ?? []).map(csr => csr.id),
  );
};

export const patchContact = async (
  accountSid: string,
  updatedBy: string,
  contactId: string,
  contactPatch: PatchPayload,
): Promise<Contact> => {
  const {
    childInformation,
    callerInformation,
    caseInformation: fullCaseInformation,
  } = contactPatch.rawJson;
  const { categories, ...caseInformation } = fullCaseInformation ?? {};
  const updated = await patch(accountSid, contactId, {
    updatedBy,
    childInformation,
    callerInformation,
    categories: <Record<string, Record<string, boolean>>>categories,
    caseInformation: Object.entries(caseInformation).length
      ? <Record<string, string | boolean>>caseInformation
      : undefined,
  });
  if (!updated) {
    throw new Error(`Contact not found with id ${contactId}`);
  }
  return updated;
};

export const connectContactToCase = async (
  accountSid: string,
  updatedBy: string,
  contactId: string,
  caseId: string,
): Promise<Contact> => {
  const updated: Contact | undefined = await connectToCase(accountSid, contactId, caseId);
  if (!updated) {
    throw new Error(`Contact not found with id ${contactId}`);
  }
  return updated;
};

function isNullOrEmptyObject(obj) {
  return obj == null || Object.keys(obj).length === 0;
}

function isValidContact(contact) {
  return (
    contact &&
    contact.rawJson &&
    !isNullOrEmptyObject(contact.rawJson.callType) &&
    !isNullOrEmptyObject(contact.rawJson.childInformation) &&
    !isNullOrEmptyObject(contact.rawJson.callerInformation) &&
    !isNullOrEmptyObject(contact.rawJson.caseInformation)
  );
}

/**
 * @openapi
 * components:
 *   schemas:
 *     SearchContactsResult:
 *       type: object
 *       required:
 *         - count
 *         - contacts
 *       properties:
 *         count:
 *           type: integer
 *           format: int32
 *           example: 1
 *         contacts:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               contactId:
 *                 type: string
 *                 example: WS17ce7c9cf654a4b240031ff7b17e7d93
 *               overview:
 *                 type: object
 *                 properties:
 *                   dateTime:
 *                     type: string
 *                     format: date-time
 *                     example: '2020-03-19T15:03:03.042Z'
 *                   name:
 *                     type: string
 *                     example: Jhon
 *                   customerNumber:
 *                     type: string
 *                     example: '+12025550163'
 *                   callType:
 *                     type: string
 *                     example: Child calling about self
 *                   categories:
 *                     type: object
 *                     example: {}
 *                   counselor:
 *                     type: string
 *                     example: WZd3d289370720216aab7e3dc023e80f5f
 *                   notes:
 *                     type: string
 *                     example: Child needs help
 *                   channel:
 *                     type: string
 *                     example: web
 *                   conversationDuration:
 *                     type: integer
 *                     format: int32
 *                     example: 42
 *               details:
 *                 type: object
 *                 properties:
 *                   timestamp:
 *                     type: integer
 *                     format: int64
 *                     example: 1565827981000
 *                   reservationId:
 *                     type: string
 *                     example: WS17ce7c9cf654a4b240031ff7b17e7d93
 *                   rawJson:
 *                     type: object
 *                     example:
 *                       {
 *                         'callType': {},
 *                         'callerInformation': {},
 *                         'childInformation': {},
 *                         'caseInformation': {},
 *                       }
 *                   queueName:
 *                     type: string
 *                     example: Admin
 *                   twilioWorkerId:
 *                     type: string
 *                     example: WZd3d289370720216aab7e3dc023e80f5f
 *                   helpline:
 *                     type: string
 *                     example:
 *                   number:
 *                     type: string
 *                     example: '+12025550163'
 *                   channel:
 *                     type: string
 *                     example: web
 *                   conversationDuration:
 *                     type: integer
 *                     format: int32
 *                     example: 42
 *                   caseId:
 *                     type: integer
 *                     format: int32
 *                     example: 1
 */
function convertContactsToSearchResults(contacts: Contact[]): SearchContact[] {
  return contacts
    .map(contact => {
      if (!isValidContact(contact)) {
        const contactJson = JSON.stringify(contact);
        console.log(`Invalid Contact: ${contactJson}`);
        return null;
      }

      const contactId = contact.id;
      const dateTime = contact.timeOfContact;
      const name = `${contact.rawJson.childInformation.name.firstName} ${contact.rawJson.childInformation.name.lastName}`;
      const customerNumber = contact.number;
      const { callType, caseInformation } = contact.rawJson;
      const categories = retrieveCategories(caseInformation.categories);
      const counselor = contact.twilioWorkerId;
      const notes = contact.rawJson.caseInformation.callSummary;
      const { channel, conversationDuration, createdBy, csamReports, helpline, taskId } = contact;

      return {
        contactId: contactId.toString(),
        overview: {
          helpline,
          dateTime: dateTime.toISOString(),
          name,
          customerNumber,
          callType,
          categories,
          counselor,
          createdBy,
          notes: notes.toString(),
          channel,
          conversationDuration,
          taskId,
        },
        csamReports,
        details: contact.rawJson,
      };
    })
    .filter(contact => contact);
}

export const searchContacts = async (
  accountSid: string,
  searchParameters: SearchParameters,
  query,
): Promise<{ count: number; contacts: SearchContact[] }> => {
  const { limit, offset } = getPaginationElements(query);
  const unprocessedResults = await search(accountSid, searchParameters, limit, offset);
  return {
    count: unprocessedResults.count,
    contacts: convertContactsToSearchResults(unprocessedResults.rows),
  };
};

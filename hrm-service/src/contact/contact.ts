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

type CreateContactPayloadWithFormProperty = Omit<NewContactRecord, 'rawJson'> & {
  form: ContactRawJson;
} & { csamReports?: CSAMReportEntry[] };

export type CreateContactPayload =
  | (NewContactRecord & { csamReports?: CSAMReportEntry[] })
  | CreateContactPayloadWithFormProperty;

const usesFormProperty = (p: CreateContactPayload): p is CreateContactPayloadWithFormProperty =>
  (<any>p).form && !(<any>p).rawJson;

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

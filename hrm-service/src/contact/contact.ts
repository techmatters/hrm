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

import {
  connectToCase,
  Contact,
  create,
  getById,
  patch,
  search,
  SearchParameters,
} from './contact-data-access';
import { ContactRawJson, getPersonsName, isS3StoredTranscript, ReferralWithoutContactId } from './contact-json';
import { retrieveCategories } from './categories';
import { getPaginationElements } from '../search';
import { NewContactRecord } from './sql/contact-insert-sql';
import { setupCanForRules } from '../permissions/setupCanForRules';
import { actionsMaps } from '../permissions';
import { TwilioUser } from '@tech-matters/twilio-worker-auth';
// eslint-disable-next-line prettier/prettier
import type { CSAMReport } from '../csam-report/csam-report';

// Re export as is:
export { updateConversationMedia, Contact } from './contact-data-access';
export * from './contact-json';

export type PatchPayload = {
  rawJson: Partial<
    Pick<ContactRawJson, 'callerInformation' | 'childInformation' | 'caseInformation'>
  >;
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
  csamReports: CSAMReport[];
  referrals?: ReferralWithoutContactId[]
};

export type CreateContactPayloadWithFormProperty = Omit<NewContactRecord, 'rawJson'> & {
  form: ContactRawJson;
} & { csamReports?: CSAMReport[], referrals?: ReferralWithoutContactId[] };

export type CreateContactPayload =
  | (NewContactRecord & { csamReports?: CSAMReport[], referrals?: ReferralWithoutContactId[] })
  | CreateContactPayloadWithFormProperty;

export const usesFormProperty = (
  p: CreateContactPayload,
): p is CreateContactPayloadWithFormProperty => (<any>p).form && !(<any>p).rawJson;

const filterExternalTranscripts = (contact: Contact) => ({
  ...contact,
  rawJson: {
    ...contact.rawJson,
    conversationMedia: contact.rawJson.conversationMedia?.filter(m => !isS3StoredTranscript(m)),
  },
});

type PermissionsBasedTransformation = {
  action: typeof actionsMaps['contact'][keyof typeof actionsMaps['contact']];
  transformation: (contact: Contact) => Contact;
};

const permissionsBasedTransformations: PermissionsBasedTransformation[] = [
  {
    action: actionsMaps.contact.VIEW_EXTERNAL_TRANSCRIPT,
    transformation: filterExternalTranscripts,
  },
];

export const bindApplyTransformations = (can: ReturnType<typeof setupCanForRules>, user: TwilioUser) => (
  contact: Contact,
) => {
  return permissionsBasedTransformations.reduce(
    (transformed, { action, transformation }) =>
      !can(user, action, contact) ? transformation(transformed) : transformed,
    contact,
  );
};

export const getContactById = async (accountSid: string, contactId: number) => {
  const contact = await getById(accountSid, contactId);

  if (!contact) {
    throw new Error(`Contact not found with id ${contactId}`);
  }

  return contact;
};

export const createContact = async (
  accountSid: string,
  createdBy: string,
  newContact: CreateContactPayload,
  { can, user }: { can: ReturnType<typeof setupCanForRules>; user: TwilioUser },
): Promise<Contact> => {
  const rawJson = usesFormProperty(newContact) ? newContact.form : newContact.rawJson;
  // const { referrals, ...withoutReferrals } = newContact;
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
  const createdContact: Contact = await create(
    accountSid,
    completeNewContact,
    (newContact.csamReports ?? []).map(csr => csr.id),
    newContact.referrals ?? [],
  );

  const applyTransformations = bindApplyTransformations(can, user);

  return applyTransformations(createdContact);
};

export const patchContact = async (
  accountSid: string,
  updatedBy: string,
  contactId: string,
  contactPatch: PatchPayload,
  { can, user }: { can: ReturnType<typeof setupCanForRules>; user: TwilioUser },
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

  const applyTransformations = bindApplyTransformations(can, user);

  return applyTransformations(updated);
};

export const connectContactToCase = async (
  accountSid: string,
  updatedBy: string,
  contactId: string,
  caseId: string,
  { can, user }: { can: ReturnType<typeof setupCanForRules>; user: TwilioUser },
): Promise<Contact> => {
  const updated: Contact | undefined = await connectToCase(accountSid, contactId, caseId);
  if (!updated) {
    throw new Error(`Contact not found with id ${contactId}`);
  }

  const applyTransformations = bindApplyTransformations(can, user);
  return applyTransformations(updated);
};

function isNullOrEmptyObject(obj) {
  return obj == null || Object.keys(obj).length === 0;
}

function isValidContact(contact) {
  return (
    contact &&
    contact.rawJson &&
    !isNullOrEmptyObject(contact.rawJson.callType) &&
    typeof contact.rawJson.childInformation === 'object' &&
    typeof contact.rawJson.callerInformation === 'object' &&
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
      // Legacy support - shouldn't be required once all flex clients are v2.1+ & contacts are migrated
      const name = getPersonsName(contact.rawJson.childInformation);
      const customerNumber = contact.number;
      const { callType, caseInformation } = contact.rawJson;
      const categories = retrieveCategories(caseInformation.categories);
      const counselor = contact.twilioWorkerId;
      const notes = contact.rawJson.caseInformation.callSummary;
      const { channel, conversationDuration, createdBy, csamReports, helpline, taskId, referrals } = contact;

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
        referrals,
        details: contact.rawJson,
      };
    })
    .filter(contact => contact);
}

export const searchContacts = async (
  accountSid: string,
  searchParameters: SearchParameters,
  query,
  { can, user }: { can: ReturnType<typeof setupCanForRules>; user: TwilioUser },
): Promise<{ count: number; contacts: SearchContact[] }> => {
  const applyTransformations = bindApplyTransformations(can, user);
  const { limit, offset } = getPaginationElements(query);
  const unprocessedResults = await search(accountSid, searchParameters, limit, offset);
  return {
    count: unprocessedResults.count,
    contacts: convertContactsToSearchResults(unprocessedResults.rows.map(applyTransformations)),
  };
};

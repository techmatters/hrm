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

import { ContactJobType } from '@tech-matters/types';
import {
  connectToCase,
  Contact,
  create,
  getById,
  patch,
  search,
  SearchParameters,
} from './contact-data-access';
import {
  ContactRawJson,
  getPersonsName,
  isS3StoredTranscript,
  isS3StoredTranscriptPending,
  ReferralWithoutContactId,
} from './contact-json';
import { retrieveCategories } from './categories';
import { getPaginationElements } from '../search';
import { NewContactRecord } from './sql/contact-insert-sql';
import { setupCanForRules } from '../permissions/setupCanForRules';
import { actionsMaps } from '../permissions';
import { TwilioUser } from '@tech-matters/twilio-worker-auth';
import { connectContactToCsamReports, CSAMReport } from '../csam-report/csam-report';
import { createReferral } from '../referral/referral-model';
import { createContactJob } from '../contact-job/contact-job';
import { isChatChannel } from './channelTypes';
import { enableCreateContactJobsFlag } from '../featureFlags';
import { db } from '../connection-pool';
import type { SearchPermissions } from '../permissions/search-permissions';

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
  referrals?: ReferralWithoutContactId[];
};

export type CreateContactPayloadWithFormProperty = Omit<NewContactRecord, 'rawJson'> & {
  form: ContactRawJson;
} & { csamReports?: CSAMReport[]; referrals?: ReferralWithoutContactId[] };

type CreateContactPayloadWithRawJsonProperty = NewContactRecord & {
  csamReports?: CSAMReport[];
  referrals?: ReferralWithoutContactId[];
};

export type CreateContactPayload =
  | CreateContactPayloadWithRawJsonProperty
  | CreateContactPayloadWithFormProperty;

export const usesFormProperty = (
  p: CreateContactPayload,
): p is CreateContactPayloadWithFormProperty => (<any>p).form && !(<any>p).rawJson;

const filterExternalTranscripts = (contact: Contact) => ({
  ...contact,
  rawJson: {
    ...contact.rawJson,
    conversationMedia: contact.rawJson.conversationMedia?.filter(
      m => !isS3StoredTranscript(m),
    ),
  },
});

type PermissionsBasedTransformation = {
  action: (typeof actionsMaps)['contact'][keyof (typeof actionsMaps)['contact']];
  transformation: (contact: Contact) => Contact;
};

const permissionsBasedTransformations: PermissionsBasedTransformation[] = [
  {
    action: actionsMaps.contact.VIEW_EXTERNAL_TRANSCRIPT,
    transformation: filterExternalTranscripts,
  },
];

export const bindApplyTransformations =
  (can: ReturnType<typeof setupCanForRules>, user: TwilioUser) => (contact: Contact) => {
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

const getNewContactPayload = (
  newContact: CreateContactPayload,
): {
  newContactPayload: NewContactRecord;
  csamReportsPayload?: CSAMReport[];
  referralsPayload?: ReferralWithoutContactId[];
} => {
  if (usesFormProperty(newContact)) {
    const {
      csamReports: csamReportsPayload,
      referrals: referralsPayload,
      form,
      ...rest
    } = newContact;

    return {
      newContactPayload: {
        ...rest,
        rawJson: newContact.form,
      },
      csamReportsPayload,
      referralsPayload,
    };
  }

  const {
    csamReports: csamReportsPayload,
    referrals: referralsPayload,
    form,
    ...newContactPayload
  } = newContact as CreateContactPayloadWithRawJsonProperty & { form?: any }; // typecast just to get rid of legacy form, if for some reason is here

  return {
    newContactPayload,
    csamReportsPayload,
    referralsPayload,
  };
};

const shouldCreateRetrieveTranscript = (contact: Contact) =>
  enableCreateContactJobsFlag &&
  isChatChannel(contact.channel) &&
  contact.rawJson?.conversationMedia?.some(isS3StoredTranscriptPending);

// Creates a contact with all its related records within a single transaction
export const createContact = async (
  accountSid: string,
  createdBy: string,
  newContact: CreateContactPayload,
  { can, user }: { can: ReturnType<typeof setupCanForRules>; user: TwilioUser },
): Promise<Contact> => {
  return db.tx(async conn => {
    const { newContactPayload, csamReportsPayload, referralsPayload } =
      getNewContactPayload(newContact);

    const completeNewContact: NewContactRecord = {
      ...newContactPayload,
      helpline: newContactPayload.helpline ?? '',
      number: newContactPayload.number ?? '',
      channel: newContactPayload.channel ?? '',
      timeOfContact: newContactPayload.timeOfContact
        ? new Date(newContactPayload.timeOfContact)
        : new Date(),
      channelSid: newContactPayload.channelSid ?? '',
      serviceSid: newContactPayload.serviceSid ?? '',
      taskId: newContactPayload.taskId ?? '',
      twilioWorkerId: newContactPayload.twilioWorkerId ?? '',
      rawJson: newContactPayload.rawJson,
      queueName:
        // Checking in rawJson might be redundant, copied from Sequelize logic in contact-controller.js
        newContactPayload.queueName || (<any>(newContactPayload.rawJson ?? {})).queueName,
      createdBy,
    };

    // create contact record (may return an exiting one cause idempotence)
    const { contact, isNewRecord } = await create(conn)(accountSid, completeNewContact);

    let contactResult: Contact;

    if (!isNewRecord) {
      // if the contact already existed, skip the associations
      contactResult = contact;
    } else {
      // associate csam reports
      const csamReportIds = (csamReportsPayload ?? []).map(csr => csr.id);
      const csamReports =
        csamReportIds && csamReportIds.length
          ? await connectContactToCsamReports(conn)(contact.id, csamReportIds, accountSid)
          : [];

      // create resources referrals
      const referrals = referralsPayload ?? [];
      const createdReferrals = [];

      if (referrals && referrals.length) {
        // Do this sequentially, it's on a single connection in a transaction anyway.
        for (const referral of referrals) {
          const { contactId, ...withoutContactId } = await createReferral(conn)(
            accountSid,
            {
              ...referral,
              contactId: contact.id.toString(),
            },
          );
          createdReferrals.push(withoutContactId);
        }
      }

      // if pertinent, create retrieve-transcript job
      if (shouldCreateRetrieveTranscript(contact)) {
        await createContactJob(conn)({
          jobType: ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
          resource: contact,
          additionalPayload: undefined,
        });
      }

      // Compose the final shape of a contact to return
      contactResult = { ...contact, csamReports, referrals: createdReferrals };
    }

    const applyTransformations = bindApplyTransformations(can, user);

    return applyTransformations(contactResult);
  });
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
      const {
        channel,
        conversationDuration,
        createdBy,
        csamReports,
        helpline,
        taskId,
        referrals,
      } = contact;

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

/**
 * Check if the user can view any contact given:
 * - search permissions
 * - counsellor' search parameter
 */
const cannotViewAnyContactsGivenThisCounsellor = (
  user: TwilioUser,
  searchPermissions: SearchPermissions,
  counsellor?: string,
) =>
  searchPermissions.canOnlyViewOwnContacts && counsellor && counsellor !== user.workerSid;

/**
 * If the counselors can only view contacts he/she owns, then we override searchParameters.counselor to workerSid
 */
const overrideCounsellor = (
  user: TwilioUser,
  searchPermissions: SearchPermissions,
  counsellor?: string,
) => (searchPermissions.canOnlyViewOwnContacts ? user.workerSid : counsellor);

export const searchContacts = async (
  accountSid: string,
  searchParameters: SearchParameters,
  query,
  {
    can,
    user,
    searchPermissions,
  }: {
    can: ReturnType<typeof setupCanForRules>;
    user: TwilioUser;
    searchPermissions: SearchPermissions;
  },
  originalFormat?: boolean,
): Promise<{ count: number; contacts: SearchContact[] | Contact[] }> => {
  const applyTransformations = bindApplyTransformations(can, user);
  const { limit, offset } = getPaginationElements(query);
  const { canOnlyViewOwnContacts } = searchPermissions;

  /**
   * VIEW_CONTACT permission:
   * Handle filtering contacts according to: https://github.com/techmatters/hrm/pull/316#discussion_r1131118034
   * The search query already filters the contacts based on the given counsellor (workerSid).
   */
  if (
    cannotViewAnyContactsGivenThisCounsellor(
      user,
      searchPermissions,
      searchParameters.counselor,
    )
  ) {
    return {
      count: 0,
      contacts: [],
    };
  } else {
    searchParameters.counselor = overrideCounsellor(
      user,
      searchPermissions,
      searchParameters.counselor,
    );
  }
  if (canOnlyViewOwnContacts) {
    searchParameters.counselor = user.workerSid;
  }

  const unprocessedResults = await search(accountSid, searchParameters, limit, offset);
  const contacts = unprocessedResults.rows.map(applyTransformations);

  return {
    count: unprocessedResults.count,
    contacts: originalFormat ? contacts : convertContactsToSearchResults(contacts),
  };
};

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

import omit from 'lodash/omit';
import { ContactJobType } from '@tech-matters/types';
import {
  connectToCase,
  Contact,
  create,
  ExistingContactRecord,
  getById,
  getByTaskSid,
  patch,
  search,
  SearchParameters,
} from './contact-data-access';
import { ContactRawJson, ReferralWithoutContactId } from './contact-json';
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
import {
  ConversationMedia,
  createConversationMedia,
  isS3StoredTranscript,
  isS3StoredTranscriptPending,
  LegacyConversationMedia,
  NewConversationMedia,
} from '../conversation-media/conversation-media';
import { deleteContactReferrals } from '../referral/referral-data-access';
import { retrieveCategories } from './categories';
import { DatabaseUniqueConstraintViolationError, inferPostgresError } from '../sql';

// Re export as is:
export { Contact } from './contact-data-access';
export * from './contact-json';

export type WithLegacyCategories<T extends Contact | NewContactRecord | PatchPayload> =
  Omit<T, 'rawJson'> & {
    rawJson?: Partial<
      Omit<ContactRawJson, 'caseInformation'> & {
        caseInformation: Record<
          string,
          string | boolean | Record<string, Record<string, boolean>>
        > & { categories?: Record<string, Record<string, boolean>> };
      }
    >;
  };

export type PatchPayload = Omit<
  ExistingContactRecord,
  'id' | 'accountSid' | 'updatedAt' | 'rawJson' | 'createdAt'
> & {
  rawJson?: Partial<ContactRawJson>;
  referrals?: ReferralWithoutContactId[];
};

export type SearchContact = {
  contactId: string;
  overview: {
    helpline: string;
    dateTime: string;
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
  details: WithLegacyCategories<Contact>['rawJson'];
  csamReports: CSAMReport[];
  referrals?: ReferralWithoutContactId[];
  conversationMedia: ConversationMedia[];
};

export type CreateContactPayload = WithLegacyCategories<NewContactRecord> & {
  csamReports?: CSAMReport[];
  referrals?: ReferralWithoutContactId[];
  conversationMedia?: NewConversationMedia[];
};

const adaptLegacyCategories = <T extends NewContactRecord | PatchPayload>(
  contact: WithLegacyCategories<T>,
): T => {
  if (!contact.rawJson?.caseInformation?.categories) return contact as T;
  const { categories: legacyCategories, ...caseInformationWithoutCategories } =
    contact.rawJson.caseInformation ?? {};
  return {
    ...contact,
    rawJson: {
      ...contact.rawJson,
      categories: contact.rawJson.categories ?? retrieveCategories(legacyCategories),
      caseInformation:
        caseInformationWithoutCategories as ContactRawJson['caseInformation'],
    },
  } as T;
};

const includeLegacyCategories = (contact: Contact): WithLegacyCategories<Contact> => {
  const legacyCategoryEntries = Object.entries(contact.rawJson.categories ?? {}).map(
    ([category, subcategories]) => {
      const subcategoryMap = Object.fromEntries(
        subcategories.map(subcategory => [subcategory, true]),
      );
      return [category, subcategoryMap];
    },
  );
  const legacyCategories = Object.fromEntries(legacyCategoryEntries);

  return {
    ...contact,
    rawJson: {
      ...contact.rawJson,
      caseInformation: {
        ...contact.rawJson.caseInformation,
        categories: legacyCategories,
      },
    },
  };
};

// TODO: Remove once all Flex clients are using new ConversationMedia model
const intoNewConversationMedia = (cm: LegacyConversationMedia): NewConversationMedia => {
  const { store: storeType, ...rest } = cm;
  return {
    storeType,
    storeTypeSpecificData: {
      ...rest,
    },
  } as NewConversationMedia;
};
// TODO: Remove once all Flex clients are using new ConversationMedia model
const intoLegacyConversationMedia = (cm: ConversationMedia): LegacyConversationMedia => {
  const { storeType, storeTypeSpecificData } = cm;
  return {
    store: storeType,
    ...storeTypeSpecificData,
  } as LegacyConversationMedia;
};
// TODO: Remove once all Flex clients are using new ConversationMedia model
const addLegacyConversationMedia = (contact: Contact): Contact =>
  contact.conversationMedia?.length
    ? {
        ...contact,
        rawJson: {
          ...contact.rawJson,
          conversationMedia: contact.conversationMedia.map(intoLegacyConversationMedia),
        },
      }
    : {
        ...contact,
        rawJson: omit(contact.rawJson, 'conversationMedia'),
      };

const filterExternalTranscripts = (contact: Contact): Contact => {
  const { conversationMedia, ...rest } = contact;
  const filteredConversationMedia = conversationMedia.filter(
    m => !isS3StoredTranscript(m),
  );

  return {
    ...rest,
    conversationMedia: filteredConversationMedia,
  };
};

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
  (can: ReturnType<typeof setupCanForRules>, user: TwilioUser) =>
  (contact: Contact): WithLegacyCategories<Contact> => {
    const permissionsBasedTransformed = permissionsBasedTransformations.reduce(
      (transformed, { action, transformation }) =>
        !can(user, action, contact) ? transformation(transformed) : transformed,
      contact,
    );

    // TODO: Remove once all Flex clients are using new ConversationMedia model
    const transformed = addLegacyConversationMedia(permissionsBasedTransformed); // This must be the last step in the transformations, except for the legacy categories

    return includeLegacyCategories(transformed);
  };

export const getContactById = async (accountSid: string, contactId: number) => {
  const contact = await getById(accountSid, contactId);

  if (!contact) {
    throw new Error(`Contact not found with id ${contactId}`);
  }

  return contact;
};

export const getContactByTaskId = async (
  accountSid: string,
  taskId: string,
  { can, user }: { can: ReturnType<typeof setupCanForRules>; user: TwilioUser },
) => {
  const contact = await getByTaskSid(accountSid, taskId);

  return contact ? bindApplyTransformations(can, user)(contact) : undefined;
};

const getNewContactPayload = (
  newContact: CreateContactPayload,
): {
  newContactPayload: NewContactRecord;
  csamReportsPayload?: CSAMReport[];
  referralsPayload?: ReferralWithoutContactId[];
  conversationMediaPayload?: NewConversationMedia[];
} => {
  const {
    csamReports: csamReportsPayload,
    referrals: referralsPayload,
    conversationMedia,
    ...newContactPayload
  } = newContact as CreateContactPayload; // typecast just to get rid of legacy form, if for some reason is here

  const { conversationMedia: legacyConversationMedia } = newContactPayload.rawJson ?? {};

  const conversationMediaPayload = conversationMedia
    ? conversationMedia
    : legacyConversationMedia
    ? legacyConversationMedia.map(intoNewConversationMedia)
    : []; // prioritize new format, but allow legacy Flex clients to send conversationMedia

  return {
    newContactPayload: omit(
      adaptLegacyCategories<NewContactRecord>(newContactPayload),
      'rawJson.conversationMedia',
    ),
    csamReportsPayload,
    referralsPayload,
    conversationMediaPayload,
  };
};

const findS3StoredTranscriptPending = (
  contact: Contact,
  conversationMedia: ConversationMedia[],
) => {
  if (enableCreateContactJobsFlag && isChatChannel(contact.channel)) {
    return conversationMedia.find(isS3StoredTranscriptPending);
  }

  return null;
};

// Creates a contact with all its related records within a single transaction
export const createContact = async (
  accountSid: string,
  createdBy: string,
  finalize: boolean,
  newContact: CreateContactPayload,
  { can, user }: { can: ReturnType<typeof setupCanForRules>; user: TwilioUser },
): Promise<WithLegacyCategories<Contact>> => {
  for (let retries = 1; retries < 4; retries++) {
    try {
      return await db.tx(async conn => {
        const {
          newContactPayload,
          csamReportsPayload,
          referralsPayload,
          conversationMediaPayload,
        } = getNewContactPayload(newContact);

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
          queueName: newContactPayload.queueName ?? '',
          createdBy,
        };

        // create contact record (may return an exiting one cause idempotence)
        const { contact, isNewRecord } = await create(conn)(
          accountSid,
          completeNewContact,
          finalize,
        );

        let contactResult: Contact;

        if (!isNewRecord) {
          // if the contact already existed, skip the associations
          contactResult = contact;
        } else {
          // associate csam reports
          const csamReportIds = (csamReportsPayload ?? []).map(csr => csr.id);
          const csamReports =
            csamReportIds && csamReportIds.length
              ? await connectContactToCsamReports(conn)(
                  contact.id,
                  csamReportIds,
                  accountSid,
                )
              : [];

          // create resources referrals
          const referrals = referralsPayload ?? [];
          const createdReferrals = [];

          if (referrals.length) {
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

          const createdConversationMedia: ConversationMedia[] = [];
          if (conversationMediaPayload && conversationMediaPayload.length) {
            for (const cm of conversationMediaPayload) {
              const conversationMedia = await createConversationMedia(conn)(accountSid, {
                contactId: contact.id,
                ...cm,
              });

              createdConversationMedia.push(conversationMedia);
            }
          }

          // if pertinent, create retrieve-transcript job
          const pendingTranscript = findS3StoredTranscriptPending(
            contact,
            createdConversationMedia,
          );
          if (pendingTranscript) {
            await createContactJob(conn)({
              jobType: ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
              resource: contact,
              additionalPayload: { conversationMediaId: pendingTranscript.id },
            });
          }

          // Compose the final shape of a contact to return
          contactResult = {
            ...contact,
            csamReports,
            referrals: createdReferrals,
            conversationMedia: createdConversationMedia,
          };
        }

        const applyTransformations = bindApplyTransformations(can, user);

        return applyTransformations(contactResult);
      });
    } catch (error) {
      // This operation can fail with a unique constraint violation if a contact with the same ID is being created concurrently
      // It shoulds only every need to retry once, but we'll do it 3 times just in case
      const postgresError = inferPostgresError(error);
      if (
        postgresError instanceof DatabaseUniqueConstraintViolationError &&
        postgresError.constraint === 'Contacts_taskId_accountSid_idx'
      ) {
        if (retries === 1) {
          console.log(
            `Retrying createContact due to taskId conflict - it should return the existing contact with this taskId next attempt (retry #${retries})`,
          );
        } else {
          console.warn(
            `Retrying createContact due to taskId conflict - it shouldn't have taken more than 1 retry to return the existing contact with this taskId but we are on retry #${retries} :-/`,
          );
        }
      } else {
        throw postgresError;
      }
    }
  }
};

export const patchContact = async (
  accountSid: string,
  updatedBy: string,
  finalize: boolean,
  contactId: string,
  contactPatch: PatchPayload,
  { can, user }: { can: ReturnType<typeof setupCanForRules>; user: TwilioUser },
): Promise<WithLegacyCategories<Contact>> => {
  const { referrals, rawJson, ...restOfPatch } =
    adaptLegacyCategories<PatchPayload>(contactPatch);
  return db.tx(async conn => {
    // if referrals are present, delete all existing and create new ones, otherwise leave them untouched
    // Explicitly specifying an empty array will delete all existing referrals
    if (referrals) {
      await deleteContactReferrals(conn)(accountSid, contactId);
      // Do this sequentially, it's on a single connection in a transaction anyway.
      for (const referral of referrals) {
        await createReferral(conn)(accountSid, {
          ...referral,
          contactId,
        });
      }
    }
    const updated = await patch(conn)(accountSid, contactId, finalize, {
      updatedBy,
      ...restOfPatch,
      ...rawJson,
    });
    if (!updated) {
      throw new Error(`Contact not found with id ${contactId}`);
    }

    const applyTransformations = bindApplyTransformations(can, user);

    return applyTransformations(updated);
  });
};

export const connectContactToCase = async (
  accountSid: string,
  updatedBy: string,
  contactId: string,
  caseId: string,
  { can, user }: { can: ReturnType<typeof setupCanForRules>; user: TwilioUser },
): Promise<WithLegacyCategories<Contact>> => {
  const updated: Contact | undefined = await connectToCase(accountSid, contactId, caseId);
  if (!updated) {
    throw new Error(`Contact not found with id ${contactId}`);
  }

  const applyTransformations = bindApplyTransformations(can, user);
  return applyTransformations(updated);
};

export const addConversationMediaToContact = async (
  accountSid: string,
  contactId: string,
  conversationMediaPayload: ConversationMedia[],
  { can, user }: { can: ReturnType<typeof setupCanForRules>; user: TwilioUser },
): Promise<WithLegacyCategories<Contact>> => {
  const contact = await getById(accountSid, parseInt(contactId));
  if (!contact) {
    throw new Error(`Target contact not found (id ${contactId})`);
  }
  return db.tx(async conn => {
    const createdConversationMedia: ConversationMedia[] = [];
    if (conversationMediaPayload && conversationMediaPayload.length) {
      for (const cm of conversationMediaPayload) {
        const conversationMedia = await createConversationMedia(conn)(accountSid, {
          contactId,
          ...cm,
        });

        createdConversationMedia.push(conversationMedia);
      }
    }

    // if pertinent, create retrieve-transcript job
    const pendingTranscript = findS3StoredTranscriptPending(
      contact,
      createdConversationMedia,
    );
    if (pendingTranscript) {
      await createContactJob(conn)({
        jobType: ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
        resource: contact,
        additionalPayload: { conversationMediaId: pendingTranscript.id },
      });
    }
    const applyTransformations = bindApplyTransformations(can, user);
    const updated = {
      ...contact,
      conversationMedia: [...contact.conversationMedia, ...createdConversationMedia],
    };
    return applyTransformations(updated);
  });
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

// Legacy support - shouldn't be required once all deployed flex clients are v2.12+
function convertContactsToSearchResults(
  contacts: WithLegacyCategories<Contact>[],
): SearchContact[] {
  return contacts
    .map(contact => {
      if (!isValidContact(contact)) {
        const contactJson = JSON.stringify(contact);
        console.log(`Invalid Contact: ${contactJson}`);
        return null;
      }

      const contactId = contact.id;
      const dateTime = contact.timeOfContact?.toISOString() ?? '--';
      const customerNumber = contact.number;
      const { callType, categories } = contact.rawJson;
      const counselor = contact.twilioWorkerId;
      const notes = contact.rawJson.caseInformation.callSummary ?? '--';
      const {
        channel,
        conversationDuration,
        createdBy,
        csamReports,
        helpline,
        taskId,
        referrals,
        conversationMedia,
      } = contact;

      return {
        contactId: contactId.toString(),
        overview: {
          helpline,
          dateTime,
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
        conversationMedia,
        details: contact.rawJson as ContactRawJson,
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
): Promise<{
  count: number;
  contacts: SearchContact[] | WithLegacyCategories<Contact>[];
}> => {
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

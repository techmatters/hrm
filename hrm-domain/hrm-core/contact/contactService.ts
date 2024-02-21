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

import { ContactJobType, TResult, isErr, newErr, newOk } from '@tech-matters/types';
import {
  connectToCase,
  Contact,
  create,
  SearchQueryFunction,
  ExistingContactRecord,
  getById,
  getByTaskSid,
  patch,
  search,
  searchByProfileId,
} from './contactDataAccess';

import { PaginationQuery, getPaginationElements } from '../search';
import type { NewContactRecord } from './sql/contactInsertSql';
import { ContactRawJson, ReferralWithoutContactId } from './contactJson';
import { InitializedCan } from '../permissions/initializeCanForRules';
import { actionsMaps } from '../permissions';
import type { TwilioUser } from '@tech-matters/twilio-worker-auth';
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
  NewConversationMedia,
} from '../conversation-media/conversation-media';
import { Profile, getOrCreateProfileWithIdentifier } from '../profile/profileService';
import { deleteContactReferrals } from '../referral/referral-data-access';
import { DatabaseUniqueConstraintViolationError, inferPostgresError } from '../sql';
import { systemUser } from '@tech-matters/twilio-worker-auth/src/twilioWorkerAuthMiddleware';

// Re export as is:
export { Contact } from './contactDataAccess';
export * from './contactJson';

export type PatchPayload = Omit<
  ExistingContactRecord,
  'id' | 'accountSid' | 'updatedAt' | 'rawJson' | 'createdAt'
> & {
  rawJson?: Partial<ContactRawJson>;
  referrals?: ReferralWithoutContactId[];
};

const filterExternalTranscripts = (contact: Contact): Contact => {
  const { conversationMedia, ...rest } = contact;
  const filteredConversationMedia = (conversationMedia ?? []).filter(
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
  (can: InitializedCan, user: TwilioUser) =>
  (contact: Contact): Contact =>
    permissionsBasedTransformations.reduce(
      (transformed, { action, transformation }) =>
        !can(user, action, contact) ? transformation(transformed) : transformed,
      contact,
    );

export const getContactById = async (
  accountSid: string,
  contactId: number,
  { can, user }: { can: InitializedCan; user: TwilioUser },
) => {
  const contact = await getById(accountSid, contactId);

  return contact ? bindApplyTransformations(can, user)(contact) : undefined;
};

export const getContactByTaskId = async (
  accountSid: string,
  taskId: string,
  { can, user }: { can: InitializedCan; user: TwilioUser },
) => {
  const contact = await getByTaskSid(accountSid, taskId);

  return contact ? bindApplyTransformations(can, user)(contact) : undefined;
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

const initProfile = async (
  conn,
  accountSid: string,
  contact: Pick<Contact, 'number'>,
) => {
  if (!contact.number) return {};

  const profileResult = await getOrCreateProfileWithIdentifier(conn)(
    accountSid,
    { identifier: contact.number },
    { user: { isSupervisor: false, roles: [], workerSid: systemUser } }, // fake the worker since makes more sense to keep the new "profile created by system"
  );

  if (isErr(profileResult)) {
    // Throw to make the transaction to rollback
    throw new Error(
      `Failed creating contact: profile result returned error variant ${profileResult.message}`,
    );
  }

  return {
    profileId: profileResult.data?.profiles?.[0].id,
    identifierId: profileResult.data?.id,
  };
};

// Creates a contact with all its related records within a single transaction
export const createContact = async (
  accountSid: string,
  createdBy: string,
  newContact: NewContactRecord,
  { can, user }: { can: InitializedCan; user: TwilioUser },
): Promise<Contact> => {
  for (let retries = 1; retries < 4; retries++) {
    try {
      return await db.tx(async conn => {
        const { profileId, identifierId } = await initProfile(
          conn,
          accountSid,
          newContact,
        );

        const completeNewContact: NewContactRecord = {
          ...newContact,
          helpline: newContact.helpline ?? '',
          number: newContact.number ?? '',
          channel: newContact.channel ?? '',
          timeOfContact: (newContact.timeOfContact
            ? new Date(newContact.timeOfContact)
            : new Date()
          ).toISOString(),
          channelSid: newContact.channelSid ?? '',
          serviceSid: newContact.serviceSid ?? '',
          taskId: newContact.taskId ?? '',
          twilioWorkerId: newContact.twilioWorkerId ?? '',
          rawJson: newContact.rawJson,
          queueName: newContact.queueName ?? '',
          createdBy,
          // Hardcoded to first profile for now, but will be updated to support multiple profiles
          profileId,
          identifierId,
        };

        // create contact record (may return an existing one cause idempotence)
        const { contact } = await create(conn)(accountSid, completeNewContact);
        contact.referrals = [];
        contact.csamReports = [];
        contact.conversationMedia = [];

        const applyTransformations = bindApplyTransformations(can, user);

        return applyTransformations(contact);
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
  { referrals, rawJson, ...restOfPatch }: PatchPayload,
  { can, user }: { can: InitializedCan; user: TwilioUser },
): Promise<Contact> => {
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

    const { profileId, identifierId } = await initProfile(conn, accountSid, restOfPatch);

    const updated = await patch(conn)(accountSid, contactId, finalize, {
      updatedBy,
      ...restOfPatch,
      ...rawJson,
      profileId,
      identifierId,
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
  { can, user }: { can: InitializedCan; user: TwilioUser },
): Promise<Contact> => {
  const updated: Contact | undefined = await connectToCase()(
    accountSid,
    contactId,
    caseId,
    updatedBy,
  );
  if (!updated) {
    throw new Error(`Contact not found with id ${contactId}`);
  }

  const applyTransformations = bindApplyTransformations(can, user);
  return applyTransformations(updated);
};

export const addConversationMediaToContact = async (
  accountSid: string,
  contactIdString: string,
  conversationMediaPayload: NewConversationMedia[],
  { can, user }: { can: InitializedCan; user: TwilioUser },
): Promise<Contact> => {
  const contactId = parseInt(contactIdString);
  const contact = await getById(accountSid, contactId);
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

const generalizedSearchContacts =
  <T extends { counselor?: string }>(searchQuery: SearchQueryFunction<T>) =>
  async (
    accountSid: string,
    searchParameters: T,
    query,
    {
      can,
      user,
      searchPermissions,
    }: {
      can: InitializedCan;
      user: TwilioUser;
      searchPermissions: SearchPermissions;
    },
  ): Promise<{
    count: number;
    contacts: Contact[];
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

    const unprocessedResults = await searchQuery(
      accountSid,
      searchParameters,
      limit,
      offset,
    );
    const contacts = unprocessedResults.rows.map(applyTransformations);

    return {
      count: unprocessedResults.count,
      contacts,
    };
  };

export const searchContacts = generalizedSearchContacts(search);

const searchContactsByProfileId = generalizedSearchContacts(searchByProfileId);

export const getContactsByProfileId = async (
  accountSid: string,
  profileId: Profile['id'],
  query: Pick<PaginationQuery, 'limit' | 'offset'>,
  ctx: {
    can: InitializedCan;
    user: TwilioUser;
    searchPermissions: SearchPermissions;
  },
): Promise<
  TResult<'InternalServerError', Awaited<ReturnType<typeof searchContactsByProfileId>>>
> => {
  try {
    const contacts = await searchContactsByProfileId(
      accountSid,
      { profileId },
      query,
      ctx,
    );

    return newOk({ data: contacts });
  } catch (err) {
    return newErr({
      message: err instanceof Error ? err.message : String(err),
      error: 'InternalServerError',
    });
  }
};

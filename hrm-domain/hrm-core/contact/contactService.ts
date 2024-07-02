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
  ContactJobType,
  TResult,
  isErr,
  newErr,
  newOk,
  Result,
  newOkFromData,
  ensureRejection,
  isOk,
  WorkerSID,
  AccountSID,
  HrmAccountId,
  TwilioUserIdentifier,
} from '@tech-matters/types';
import { getClient } from '@tech-matters/elasticsearch-client';
import {
  HRM_CONTACTS_INDEX_TYPE,
  hrmSearchConfiguration,
} from '@tech-matters/hrm-search-config';

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
  searchByIds,
} from './contactDataAccess';

import { type PaginationQuery, getPaginationElements } from '../search';
import type { NewContactRecord } from './sql/contactInsertSql';
import type { ContactRawJson, ReferralWithoutContactId } from './contactJson';
import { InitializedCan } from '../permissions/initializeCanForRules';
import { actionsMaps } from '../permissions';
import type { TwilioUser } from '@tech-matters/twilio-worker-auth';
import { createReferral } from '../referral/referral-model';
import { createContactJob } from '../contact-job/contact-job';
import { isChatChannel } from '@tech-matters/hrm-types';
import {
  enableCreateContactJobsFlag,
  enablePublishHrmSearchIndex,
} from '../featureFlags';
import { db } from '../connection-pool';
import {
  type ConversationMedia,
  type NewConversationMedia,
  createConversationMedia,
  isS3StoredTranscript,
  isS3StoredTranscriptPending,
  updateConversationMediaSpecificData,
} from '../conversation-media/conversation-media';
import {
  type Profile,
  getOrCreateProfileWithIdentifier,
} from '../profile/profileService';
import { deleteContactReferrals } from '../referral/referral-data-access';
import {
  DatabaseErrorResult,
  isDatabaseUniqueConstraintViolationErrorResult,
} from '../sql';
import { systemUser } from '@tech-matters/twilio-worker-auth';
import { publishContactToSearchIndex } from '../jobs/search/publishToSearchIndex';
import type { RulesFile, TKConditionsSets } from '../permissions/rulesMap';
import type { IndexMessage } from '@tech-matters/hrm-search-config';
import {
  ContactListCondition,
  generateContactSearchFilters,
  generateContactPermissionsFilters,
} from './contactSearchIndex';

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
  accountSid: HrmAccountId,
  contactId: number,
  { can, user }: { can: InitializedCan; user: TwilioUser },
) => {
  const contact = await getById(accountSid, contactId);

  return contact ? bindApplyTransformations(can, user)(contact) : undefined;
};

export const getContactByTaskId = async (
  accountSid: HrmAccountId,
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
  hrmAccountId: HrmAccountId,
  contact: Pick<Contact, 'number'>,
): Promise<
  Result<DatabaseErrorResult, { profileId?: number; identifierId?: number }>
> => {
  if (!contact.number) return newOk({ data: {} });
  const [accountSid] = hrmAccountId.split('-') as [AccountSID];

  const profileResult = await getOrCreateProfileWithIdentifier(conn)(
    hrmAccountId,
    { identifier: { identifier: contact.number }, profile: { name: null } },
    { user: { accountSid, isSupervisor: false, roles: [], workerSid: systemUser } }, // fake the worker since makes more sense to keep the new "profile created by system"
  );

  if (isErr(profileResult)) {
    return profileResult;
  }

  return newOkFromData({
    profileId: profileResult.data?.identifier?.profiles?.[0].id,
    identifierId: profileResult.data?.identifier?.id,
  });
};

const doContactInSearchIndexOP =
  (operation: IndexMessage['operation']) =>
  async ({
    accountSid,
    contactId,
  }: {
    accountSid: Contact['accountSid'];
    contactId: Contact['id'];
  }) => {
    try {
      if (!enablePublishHrmSearchIndex) {
        return;
      }

      const contact = await getById(accountSid, contactId);

      if (contact) {
        await publishContactToSearchIndex({ accountSid, contact, operation });
      }
    } catch (err) {
      console.error(
        `Error trying to index contact: accountSid ${accountSid} contactId ${contactId}`,
        err,
      );
    }
  };

const indexContactInSearchIndex = doContactInSearchIndexOP('index');
const removeContactInSearchIndex = doContactInSearchIndexOP('remove');

// Creates a contact with all its related records within a single transaction
export const createContact = async (
  accountSid: HrmAccountId,
  createdBy: WorkerSID,
  newContact: NewContactRecord,
  { can, user }: { can: InitializedCan; user: TwilioUser },
): Promise<Contact> => {
  let result: Result<DatabaseErrorResult, Contact>;
  for (let retries = 1; retries < 4; retries++) {
    result = await ensureRejection<DatabaseErrorResult, Contact>(db.tx)(async conn => {
      const res = await initProfile(conn, accountSid, newContact);
      if (isErr(res)) {
        return res;
      }
      const { profileId, identifierId } = res.data;

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
        twilioWorkerId: newContact.twilioWorkerId,
        rawJson: newContact.rawJson,
        queueName: newContact.queueName ?? '',
        createdBy,
        // Hardcoded to first profile for now, but will be updated to support multiple profiles
        profileId,
        identifierId,
      };
      const contactCreateResult = await create(conn)(accountSid, completeNewContact);
      if (isErr(contactCreateResult)) {
        return contactCreateResult;
      }
      // create contact record (may return an existing one cause idempotence)
      const { contact } = contactCreateResult.data;
      contact.referrals = [];
      contact.csamReports = [];
      contact.conversationMedia = [];

      const applyTransformations = bindApplyTransformations(can, user);

      return newOkFromData(applyTransformations(contact));
    });
    if (isOk(result)) {
      // trigger index operation but don't await for it
      indexContactInSearchIndex({ accountSid, contactId: result.data.id });
      return result.data;
    }
    // This operation can fail with a unique constraint violation if a contact with the same ID is being created concurrently
    // It should only every need to retry once, but we'll do it 3 times just in case
    if (
      isDatabaseUniqueConstraintViolationErrorResult(result) &&
      (result.constraint === 'Contacts_taskId_accountSid_idx' ||
        result.constraint === 'Identifiers_identifier_accountSid')
    ) {
      if (retries === 1) {
        console.log(
          `Retrying createContact due to '${result.constraint}' data constraint conflict - it should use the existing resource next attempt (retry #${retries})`,
        );
      } else {
        console.warn(
          `Retrying createContact due to '${result.constraint}' data constraint conflict  - it shouldn't have taken more than 1 retry to return the existing contact with this taskId but we are on retry #${retries} :-/`,
        );
      }
    } else {
      return result.unwrap();
    }
  }

  return result.unwrap();
};

export const patchContact = async (
  accountSid: HrmAccountId,
  updatedBy: TwilioUserIdentifier,
  finalize: boolean,
  contactId: string,
  { referrals, rawJson, ...restOfPatch }: PatchPayload,
  { can, user }: { can: InitializedCan; user: TwilioUser },
): Promise<Contact> =>
  db.tx(async conn => {
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
    const res = await initProfile(conn, accountSid, restOfPatch);
    if (isErr(res)) {
      throw res.rawError;
    }

    const { profileId, identifierId } = res.data;

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

    // trigger index operation but don't await for it
    indexContactInSearchIndex({ accountSid, contactId: parseInt(contactId, 10) });

    return applyTransformations(updated);
  });

export const connectContactToCase = async (
  accountSid: HrmAccountId,
  contactId: string,
  caseId: string,
  { can, user }: { can: InitializedCan; user: TwilioUser },
): Promise<Contact> => {
  if (caseId === null) {
    // trigger remove operation, awaiting for it, since we'll lost the information of which is the "old case" otherwise
    await removeContactInSearchIndex({ accountSid, contactId: parseInt(contactId, 10) });
  }

  const updated: Contact | undefined = await connectToCase()(
    accountSid,
    contactId,
    caseId,
    user.workerSid,
  );
  if (!updated) {
    throw new Error(`Contact not found with id ${contactId}`);
  }

  const applyTransformations = bindApplyTransformations(can, user);

  // trigger index operation but don't await for it
  indexContactInSearchIndex({ accountSid, contactId: parseInt(contactId, 10) });

  return applyTransformations(updated);
};

export const addConversationMediaToContact = async (
  accountSid: HrmAccountId,
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

    // trigger index operation but don't await for it
    indexContactInSearchIndex({ accountSid, contactId: parseInt(contactIdString, 10) });

    return applyTransformations(updated);
  });
};

const generalizedSearchContacts =
  <T extends { counselor?: string }>(searchQuery: SearchQueryFunction<T>) =>
  async (
    accountSid: HrmAccountId,
    searchParameters: T,
    query,
    {
      can,
      user,
      permissions,
    }: {
      can: InitializedCan;
      user: TwilioUser;
      permissions: RulesFile;
    },
  ): Promise<{
    count: number;
    contacts: Contact[];
  }> => {
    const applyTransformations = bindApplyTransformations(can, user);
    const { limit, offset } = getPaginationElements(query);

    const unprocessedResults = await searchQuery(
      accountSid,
      searchParameters,
      limit,
      offset,
      user,
      permissions.viewContact as TKConditionsSets<'contact'>,
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
  accountSid: HrmAccountId,
  profileId: Profile['id'],
  query: Pick<PaginationQuery, 'limit' | 'offset'>,
  ctx: {
    can: InitializedCan;
    user: TwilioUser;
    permissions: RulesFile;
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

const searchContactsByIds = generalizedSearchContacts(searchByIds);

export const searchContactsV2 = async (
  accountSid: HrmAccountId,
  searchParameters: {
    searchTerm: string;
    counselor?: string;
    dateFrom?: string;
    dateTo?: string;
  },
  query: Pick<PaginationQuery, 'limit' | 'offset'>,
  ctx: {
    can: InitializedCan;
    user: TwilioUser;
    permissions: RulesFile;
  },
): Promise<TResult<'InternalServerError', { count: number; contacts: Contact[] }>> => {
  try {
    const { searchTerm, counselor, dateFrom, dateTo } = searchParameters;
    const { limit, offset } = query;

    const pagination = {
      limit: parseInt((limit as string) || '20', 10),
      start: parseInt((offset as string) || '0', 10),
    };

    const searchFilters = generateContactSearchFilters({ counselor, dateFrom, dateTo });
    const permissionFilters = generateContactPermissionsFilters({
      user: ctx.user,
      viewContact: ctx.permissions.viewContact as ContactListCondition[][],
      viewTranscript: ctx.permissions.viewExternalTranscript as ContactListCondition[][],
    });

    const client = (
      await getClient({
        accountSid,
        indexType: HRM_CONTACTS_INDEX_TYPE,
        ssmConfigParameter: process.env.SSM_PARAM_ELASTICSEARCH_CONFIG,
      })
    ).searchClient(hrmSearchConfiguration);

    const { total, items } = await client.search({
      searchParameters: {
        type: 'contact',
        searchTerm,
        searchFilters,
        permissionFilters,
        pagination,
      },
    });

    const contactIds = items.map(item => parseInt(item.id, 10));

    const { contacts } = await searchContactsByIds(
      accountSid,
      { contactIds },
      query,
      ctx,
    );

    return newOk({ data: { count: total, contacts } });
  } catch (err) {
    return newErr({
      message: err instanceof Error ? err.message : String(err),
      error: 'InternalServerError',
    });
  }
};

/**
 * wrapper around updateSpecificData that also triggers a re-index operation when the conversation media gets updated (e.g. when transcript is exported)
 */
export const updateConversationMediaData =
  (contactId: Contact['id']) =>
  async (
    ...[accountSid, id, storeTypeSpecificData]: Parameters<
      typeof updateConversationMediaSpecificData
    >
  ): ReturnType<typeof updateConversationMediaSpecificData> => {
    const result = await updateConversationMediaSpecificData(
      accountSid,
      id,
      storeTypeSpecificData,
    );

    // trigger index operation but don't await for it
    indexContactInSearchIndex({ accountSid, contactId });

    return result;
  };

import { actionsMaps, User } from '../permissions';

import { db } from '../connection-pool';
import { enableCreateContactJobsFlag } from '../featureFlags';
import {
  UPDATE_CASEID_BY_ID,
  UPDATE_RAWJSON_BY_ID,
  UPDATE_CONVERSATION_MEDIA_BY_ID,
} from './sql/contact-update-sql';
import { SELECT_CONTACT_SEARCH } from './sql/contact-search-sql';
import { endOfDay, parseISO, startOfDay } from 'date-fns';
import { selectSingleContactByIdSql, selectSingleContactByTaskId } from './sql/contact-get-sql';
import { insertContactSql, NewContactRecord } from './sql/contact-insert-sql';
import { ContactRawJson, isS3StoredTranscriptPending, PersonInformation } from './contact-json';
import { createContactJob, ContactJobType } from '../contact-job/contact-job-data-access';
import { isChatChannel } from './channelTypes';

type ExistingContactRecord = {
  id: number;
  accountSid: string;
  createdAt?: Date;
  updatedAt?: Date;
} & Partial<NewContactRecord>;

export type Contact = ExistingContactRecord & {
  csamReports: any[];
};

export type SearchParameters = {
  helpline?: string;
  firstName?: string;
  lastName?: string;
  counselor?: string;
  phoneNumber?: string;
  dateFrom?: string;
  dateTo?: string;
  contactNumber?: string;
  onlyDataContacts: boolean;
};

/**
 * Represents the individual parts of the contact that can be overwritten in a patch operation
 * Each of these parameters will overwrite the specific part of the contact it relates to completely, but leave the rest of the contact data unmodified
 */
export type ContactUpdates = {
  childInformation?: PersonInformation;
  callerInformation?: PersonInformation;
  caseInformation?: Record<string, string | boolean>;
  categories?: Record<string, Record<string, boolean>>;
  updatedBy: string;
};

// Intentionally adding only the types of interest here
const callTypes = {
  child: 'Child calling about self',
  caller: 'Someone calling about a child',
};

type QueryParams = {
  accountSid: string;
  firstNamePattern?: string;
  lastNamePattern?: string;
  phoneNumberPattern?: string;
  counselor?: string;
  dateTo?: string;
  dateFrom?: string;
  contactNumber?: string;
  helpline?: string;
  onlyDataContacts: boolean;
  dataCallTypes: string[];
  limit: number;
  offset: number;
};

const searchParametersToQueryParameters = (
  accountSid: string,
  {
    firstName,
    lastName,
    phoneNumber,
    dateFrom,
    dateTo,
    helpline,
    contactNumber,
    counselor,
    ...restOfSearch
  }: {
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    dateFrom?: string;
    dateTo?: string;
    contactNumber?: string;
    helpline?: string;
    counselor?: string;
  },
  limit: number,
  offset: number,
): QueryParams => {
  const queryParams: QueryParams = {
    ...{
      helpline: undefined,
      lastNamePattern: undefined,
      firstNamePattern: undefined,
      phoneNumberPattern: undefined,
      counselor: undefined,
      contactNumber: undefined,
      onlyDataContacts: false,
    },
    ...restOfSearch,
    helpline: helpline || undefined, // ensure empty strings are replaced with nulls
    contactNumber: contactNumber || undefined, // ensure empty strings are replaced with nulls
    counselor: counselor || undefined, // ensure empty strings are replaced with nulls
    dateFrom: dateFrom ? startOfDay(parseISO(dateFrom)).toISOString() : undefined,
    dateTo: dateTo ? endOfDay(parseISO(dateTo)).toISOString() : undefined,
    accountSid,

    dataCallTypes: Object.values(callTypes),
    limit,
    offset,
  };
  if (firstName) {
    queryParams.firstNamePattern = `%${firstName}%`;
  }
  if (lastName) {
    queryParams.lastNamePattern = `%${lastName}%`;
  }
  if (phoneNumber) {
    queryParams.phoneNumberPattern = `%${phoneNumber.replace(/[\D]/gi, '')}%`;
  }
  return queryParams;
};

const filterExternalTranscripts = (contact: Contact) => ({
  ...contact,
  rawJson: {
    ...contact.rawJson,
    conversationMedia: contact.rawJson.conversationMedia?.filter(m => !isS3StoredTranscript(m)),
  },
});

const permissionFilters = [
  {
    action: actionsMaps.contact.VIEW_EXTERNAL_TRANSCRIPT,
    filter: filterExternalTranscripts,
  },
];

/**
 * In contrast to other permission based functions that are middlewares,
 * this function is applied after the contact records are brought from the DB,
 * stripping certain properties based on the permissions.
 * This rules are defined here so they have better visibility,
 * but this function is "injected" into the business layer that's where we have access to the "raw contact entities".
 */
export const applyContactPermissionsBasedTransformer = (user: User, contact: Contact) => {
  let result: Contact = contact;

  permissionFilters.forEach(({ action, filter }) => {
    // Filters the external transcript records if user does not have permission on this contact
    if (!user.can(action, contact)) {
      result = filter(result);
    }
  });

  return result;
};

export const create = async (
  user: User,
  newContact: NewContactRecord,
  csamReportIds: number[],
): Promise<Contact> => {
  return db.tx(async connection => {
    if (newContact.taskId) {
      const existingContact: Contact = await connection.oneOrNone<Contact>(
        selectSingleContactByTaskId('Contacts'),
        {
          user.accountSid,
          taskId: newContact.taskId,
        },
      );
      if (existingContact) {
        // A contact with the same task ID already exists, return it
        return existingContact;
      }
    }

    const now = new Date();
    const created: Contact = await connection.one<Contact>(
      insertContactSql({
        ...newContact,
        user.accountSid,
        createdAt: now,
        updatedAt: now,
      }),
      { csamReportIds },
    );

    if (
      enableCreateContactJobsFlag &&
      isChatChannel(created.channel) &&
      created.rawJson?.conversationMedia?.some(isS3StoredTranscriptPending)
    ) {
      await createContactJob(connection)({
        jobType: ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
        resource: created,
        additionalPayload: undefined,
      });
    }

    return applyContactPermissionsBasedTransformer(user, created);
  });
};

export const patch = async (
  user: User,
  contactId: string,
  contactUpdates: ContactUpdates,
): Promise<Contact | undefined> => {
  return db.task(async connection => {
    const updatedContact: Contact = await connection.oneOrNone<Contact>(UPDATE_RAWJSON_BY_ID, {
      user.accountSid,
      contactId,
      ...contactUpdates,
    });
    return applyContactPermissionsBasedTransformer(user, updatedContact);
  });
};

export const connectToCase = async (
  user: User,
  contactId: string,
  caseId: string,
): Promise<Contact | undefined> => {
  return db.task(async connection => {
    const updatedContact: Contact = await connection.oneOrNone<Contact>(UPDATE_CASEID_BY_ID, {
      user.accountSid,
      contactId,
      caseId,
    });
    return applyContactPermissionsBasedTransformer(user, updatedContact);
  });
};

export const getById = async (
    user: User,
    contactId: number
  ): Promise<Contact> =>
  db.task(async connection => {
    const contact = await connection.oneOrNone<Contact>(selectSingleContactByIdSql('Contacts'), {
      user.accountSid,
      contactId,
    }),

    return applyContactPermissionsBasedTransformer(user, contact);
  });

export const search = async (
  user: User,
  searchParameters: SearchParameters,
  limit: number,
  offset: number,
): Promise<{ rows: Contact[]; count: number }> => {
  return db.task(async connection => {
    const searchResults: (Contact & { totalCount: number })[] = await connection.manyOrNone<
      Contact & { totalCount: number }
    >(
      SELECT_CONTACT_SEARCH,
      searchParametersToQueryParameters(user.accountSid, searchParameters, limit, offset),
    );

    const rows = searchResults.map(contact => applyContactPermissionsBasedTransformer(user, contact));
    return { rows, count: searchResults.length ? searchResults[0].totalCount : 0 };
  });
};

export const updateConversationMedia = async (
  user: User,
  contactId: number,
  conversationMedia: ContactRawJson['conversationMedia'],
): Promise<void> =>
  db.task(async connection =>
    connection.none(UPDATE_CONVERSATION_MEDIA_BY_ID, {
      user.accountSid,
      contactId,
      conversationMedia,
    }),
  );

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

import { db } from '../connection-pool';
import {
  UPDATE_CASEID_BY_ID,
  UPDATE_RAWJSON_BY_ID,
  UPDATE_CONVERSATION_MEDIA_BY_ID,
} from './sql/contact-update-sql';
import { SELECT_CONTACT_SEARCH } from './sql/contact-search-sql';
import { endOfDay, parseISO, startOfDay } from 'date-fns';
import {
  selectSingleContactByIdSql,
  selectSingleContactByTaskId,
} from './sql/contact-get-sql';
import { insertContactSql, NewContactRecord } from './sql/contact-insert-sql';
import {
  ContactRawJson,
  PersonInformation,
  ReferralWithoutContactId,
} from './contact-json';
import type { ITask } from 'pg-promise';
import { txIfNotInOne } from '../sql';
import { ConversationMedia } from '../conversation-media/conversation-media-data-access';

type ExistingContactRecord = {
  id: number;
  accountSid: string;
  createdAt?: Date;
  updatedAt?: Date;
} & Partial<NewContactRecord>;

export type Contact = ExistingContactRecord & {
  csamReports: any[];
  referrals?: ReferralWithoutContactId[];
  conversationMedia?: ConversationMedia[];
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
  shouldIncludeUpdatedAt?: boolean;
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
      shouldIncludeUpdatedAt: false,
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

export const create =
  (task?) =>
  async (
    accountSid: string,
    newContact: NewContactRecord,
  ): Promise<{ contact: Contact; isNewRecord: boolean }> => {
    // Inner query that will be executed in a pgp.ITask
    const executeQuery = async (
      conn: ITask<{ contact: Contact; isNewRecord: boolean }>,
    ) => {
      if (newContact.taskId) {
        const existingContact: Contact = await conn.oneOrNone<Contact>(
          selectSingleContactByTaskId('Contacts'),
          {
            accountSid,
            taskId: newContact.taskId,
          },
        );
        if (existingContact) {
          // A contact with the same task ID already exists, return it
          return { contact: existingContact, isNewRecord: false };
        }
      }

      const now = new Date();
      const created: Contact = await conn.one<Contact>(
        insertContactSql({
          ...newContact,
          accountSid,
          createdAt: now,
          updatedAt: now,
        }),
      );

      return { contact: created, isNewRecord: true };
    };

    return txIfNotInOne(task, executeQuery);
  };

export const patch = async (
  accountSid: string,
  contactId: string,
  contactUpdates: ContactUpdates,
): Promise<Contact | undefined> => {
  return db.task(async connection => {
    const updatedContact: Contact = await connection.oneOrNone<Contact>(
      UPDATE_RAWJSON_BY_ID,
      {
        accountSid,
        contactId,
        ...contactUpdates,
      },
    );
    return updatedContact;
  });
};

export const connectToCase = async (
  accountSid: string,
  contactId: string,
  caseId: string,
): Promise<Contact | undefined> => {
  return db.task(async connection => {
    const updatedContact: Contact = await connection.oneOrNone<Contact>(
      UPDATE_CASEID_BY_ID,
      {
        accountSid,
        contactId,
        caseId,
      },
    );
    return updatedContact;
  });
};

export const getById = async (accountSid: string, contactId: number): Promise<Contact> =>
  db.task(async connection =>
    connection.oneOrNone<Contact>(selectSingleContactByIdSql('Contacts'), {
      accountSid,
      contactId,
    }),
  );

export const search = async (
  accountSid: string,
  searchParameters: SearchParameters,
  limit: number,
  offset: number,
): Promise<{ rows: Contact[]; count: number }> => {
  return db.task(async connection => {
    const searchResults: (Contact & { totalCount: number })[] =
      await connection.manyOrNone<Contact & { totalCount: number }>(
        SELECT_CONTACT_SEARCH,
        searchParametersToQueryParameters(accountSid, searchParameters, limit, offset),
      );
    return {
      rows: searchResults,
      count: searchResults.length ? searchResults[0].totalCount : 0,
    };
  });
};

export const updateConversationMedia = async (
  accountSid: string,
  contactId: number,
  conversationMedia: ContactRawJson['conversationMedia'],
): Promise<void> =>
  db.task(async connection =>
    connection.none(UPDATE_CONVERSATION_MEDIA_BY_ID, {
      accountSid,
      contactId,
      conversationMedia,
    }),
  );

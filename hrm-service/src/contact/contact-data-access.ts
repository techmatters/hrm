import { db } from '../connection-pool';
import { UPDATE_CASEID_BY_ID, UPDATE_RAWJSON_BY_ID } from './sql/contact-update-sql';
import { SELECT_CONTACT_SEARCH } from './sql/contact-search-sql';
import { endOfDay, parseISO, startOfDay } from 'date-fns';
import { selectSingleContactByIdSql, selectSingleContactByTaskId } from './sql/contact-get-sql';
import { insertContactSql, NewContactRecord } from './sql/contact-insert-sql';
import { PersonInformation } from './contact-json';

type ExistingContactRecord = {
  id: number;
  accountSid: string;
  createdAt?: Date;
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

export const create = async (
  accountSid: string,
  newContact: NewContactRecord,
  csamReportIds: number[],
): Promise<Contact> => {
  return db.tx(async connection => {
    if (newContact.taskId) {
      const existingContact: Contact = await connection.oneOrNone<Contact>(
        selectSingleContactByTaskId('Contacts'),
        {
          accountSid,
          taskId: newContact.taskId,
        },
      );
      if (existingContact) {
        // A contact with the same task ID already exists, return it
        return existingContact;
      }
    }
    const now = new Date();
    const updatedContact: Contact = await connection.one<Contact>(
      insertContactSql({
        ...newContact,
        accountSid,
        createdAt: now,
        updatedAt: now,
      }),
      { csamReportIds },
    );
    return updatedContact;
  });
};

export const patch = async (
  accountSid: string,
  contactId: string,
  contactUpdates: ContactUpdates,
): Promise<Contact | undefined> => {
  return db.task(async connection => {
    const updatedContact: Contact = await connection.oneOrNone<Contact>(UPDATE_RAWJSON_BY_ID, {
      accountSid,
      contactId,
      ...contactUpdates,
    });
    return updatedContact;
  });
};

export const connectToCase = async (
  accountSid: string,
  contactId: string,
  caseId: string,
): Promise<Contact | undefined> => {
  return db.task(async connection => {
    const updatedContact: Contact = await connection.oneOrNone<Contact>(UPDATE_CASEID_BY_ID, {
      accountSid,
      contactId,
      caseId,
    });
    return updatedContact;
  });
};

export const getById = async (accountSid: string, contactId: string): Promise<Contact> =>
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
    const searchResults: (Contact & { totalCount: number })[] = await connection.manyOrNone<
      Contact & { totalCount: number }
    >(
      SELECT_CONTACT_SEARCH,
      searchParametersToQueryParameters(accountSid, searchParameters, limit, offset),
    );
    return { rows: searchResults, count: searchResults.length ? searchResults[0].totalCount : 0 };
  });
};

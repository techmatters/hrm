import { db } from '../connection-pool';
import { UPDATE_CASEID_BY_ID, UPDATE_RAWJSON_BY_ID } from './sql/contact-update-sql';
import { SELECT_CONTACT_SEARCH } from './sql/contact-search-sql';

type NestedInformation = { name: { firstName: string; lastName: string } };

type PersonInformation = NestedInformation & {
  [key: string]: string | boolean | NestedInformation[keyof NestedInformation]; // having NestedInformation[keyof NestedInformation] makes type looser here because of this https://github.com/microsoft/TypeScript/issues/17867. Possible/future solution https://github.com/microsoft/TypeScript/pull/29317
};

/**
 * This and contained types are copied from Flex
 */
export type ContactRawJson = {
  definitionVersion?: string;
  callType: string;
  childInformation: PersonInformation;
  callerInformation?: PersonInformation;
  caseInformation: {
    categories: Record<string, Record<string, boolean>>;
    [key: string]: string | boolean | Record<string, Record<string, boolean>>;
  };
  contactlessTask?: { [key: string]: string | boolean };
};

type ContactRecord = {
  id: number;
  rawJson?: ContactRawJson;
  queueName?: string;
  twilioWorkerId?: string;
  createdBy?: string;
  helpline?: string;
  number?: string;
  channel?: string;
  conversationDuration?: number;
  accountSid: string;
  createdAt?: Date;
  timeOfContact?: Date;
  taskId?: string;
  channelSid?: string;
  serviceSid?: string;
};

export type Contact = ContactRecord & {
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

import { endOfDay, startOfDay, parseISO } from 'date-fns';

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
  onlyDataContact: boolean;
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
    ...restOfSearch
  }: {
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    dateFrom?: string;
    dateTo?: string;
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
      onlyDataContact: false,
    },
    dateFrom: dateFrom ? startOfDay(parseISO(dateFrom)).toISOString() : undefined,
    dateTo: dateTo ? endOfDay(parseISO(dateTo)).toISOString() : undefined,
    ...restOfSearch,
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

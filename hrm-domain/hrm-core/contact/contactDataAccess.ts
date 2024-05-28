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
import { selectContactSearch, selectContactsByProfileId } from './sql/contactSearchSql';
import { UPDATE_CASEID_BY_ID, UPDATE_CONTACT_BY_ID } from './sql/contact-update-sql';
import { parseISO } from 'date-fns';
import {
  selectSingleContactByIdSql,
  selectSingleContactByTaskId,
} from './sql/contact-get-sql';
import { INSERT_CONTACT_SQL, NewContactRecord } from './sql/contactInsertSql';
import { ContactRawJson } from './contactJson';
import type { ITask } from 'pg-promise';
import { DatabaseErrorResult, inferPostgresErrorResult, txIfNotInOne } from '../sql';
import { TOUCH_CASE_SQL } from '../case/sql/caseUpdateSql';
import { TKConditionsSets } from '../permissions/rulesMap';
import { TwilioUser } from '@tech-matters/twilio-worker-auth';
import {
  TwilioUserIdentifier,
  HrmAccountId,
  Result,
  newOkFromData,
} from '@tech-matters/types';

import { ExistingContactRecord, Contact } from '@tech-matters/hrm-types';

export { ExistingContactRecord, Contact };

export type SearchParameters = {
  helpline?: string;
  firstName?: string;
  lastName?: string;
  counselor?: string;
  phoneNumber?: string;
  dateFrom?: string;
  dateTo?: string;
  contactNumber?: string;
  onlyDataContacts?: boolean;
  shouldIncludeUpdatedAt?: boolean;
};

/**
 * Represents the individual parts of the contact that can be overwritten in a patch operation
 * Each of these parameters will overwrite the specific part of the contact it relates to completely, but leave the rest of the contact data unmodified
 */
export type ContactUpdates = Omit<
  ExistingContactRecord,
  'id' | 'accountSid' | 'rawJson' | 'createdAt' | 'finalizedAt'
> &
  Partial<ContactRawJson>;

const BLANK_CONTACT_UPDATES: ContactUpdates = {
  caseInformation: undefined,
  callerInformation: undefined,
  categories: undefined,
  childInformation: undefined,
  contactlessTask: undefined,
  callType: undefined,
  definitionVersion: undefined,
  queueName: undefined,
  helpline: undefined,
  channel: undefined,
  number: undefined,
  timeOfContact: undefined,
  taskId: undefined,
  channelSid: undefined,
  serviceSid: undefined,
  caseId: undefined,
  twilioWorkerId: undefined,
  conversationDuration: undefined,
};

// Intentionally adding only the types of interest here
const callTypes = {
  child: 'Child calling about self',
  caller: 'Someone calling about a child',
};

type QueryParams = {
  accountSid: HrmAccountId;
  twilioWorkerSid: TwilioUserIdentifier;
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
  accountSid: HrmAccountId,
  { workerSid }: TwilioUser,
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
    dateFrom: dateFrom ? parseISO(dateFrom).toISOString() : undefined,
    dateTo: dateTo ? parseISO(dateTo).toISOString() : undefined,
    accountSid,
    twilioWorkerSid: workerSid,

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

type CreateResultRecord = Contact & { isNewRecord: boolean };
type CreateResult = { contact: Contact; isNewRecord: boolean };

export const create =
  (task?) =>
  async (
    accountSid: HrmAccountId,
    newContact: NewContactRecord,
  ): Promise<Result<DatabaseErrorResult, CreateResult>> => {
    try {
      return newOkFromData(
        await txIfNotInOne(
          task,
          async (conn: ITask<{ contact: Contact; isNewRecord: boolean }>) => {
            const now = new Date();
            const { isNewRecord, ...created }: CreateResultRecord =
              await conn.one<CreateResultRecord>(INSERT_CONTACT_SQL, {
                ...newContact,
                accountSid,
                createdAt: now,
                updatedAt: now,
              });

            return { contact: created, isNewRecord };
          },
        ),
      );
    } catch (error) {
      return inferPostgresErrorResult(error);
    }
  };

export const patch =
  (task?) =>
  async (
    accountSid: HrmAccountId,
    contactId: string,
    finalize: boolean,
    contactUpdates: ContactUpdates,
  ): Promise<Contact | undefined> => {
    return txIfNotInOne(task, async connection => {
      const updatedContact: Contact = await connection.oneOrNone<Contact>(
        UPDATE_CONTACT_BY_ID,
        {
          ...BLANK_CONTACT_UPDATES,
          accountSid,
          contactId,
          ...contactUpdates,
          finalize,
        },
      );
      return updatedContact;
    });
  };

export const connectToCase =
  (task?) =>
  async (
    accountSid: HrmAccountId,
    contactId: string,
    caseId: string,
    updatedBy: string,
  ): Promise<Contact | undefined> => {
    return txIfNotInOne(task, async connection => {
      const [[updatedContact]]: Contact[][] = await connection.multi<Contact>(
        [UPDATE_CASEID_BY_ID, TOUCH_CASE_SQL].join(';\n'),
        {
          accountSid,
          contactId,
          caseId,
          updatedBy,
        },
      );
      return updatedContact;
    });
  };

export const getById = async (
  accountSid: HrmAccountId,
  contactId: number,
): Promise<Contact> =>
  db.task(async connection =>
    connection.oneOrNone<Contact>(selectSingleContactByIdSql('Contacts'), {
      accountSid,
      contactId,
    }),
  );

export const getByTaskSid = async (
  accountSid: HrmAccountId,
  taskId: string,
): Promise<Contact> =>
  db.task(async connection =>
    connection.oneOrNone<Contact>(selectSingleContactByTaskId('Contacts'), {
      accountSid,
      taskId,
    }),
  );

type BaseSearchQueryParams = {
  accountSid: HrmAccountId;
  limit: number;
  offset: number;
};
export type OptionalSearchQueryParams = Partial<QueryParams>;
type SearchQueryParamsBuilder<T> = (
  accountSid: HrmAccountId,
  user: TwilioUser,
  searchParameters: T,
  limit: number,
  offset: number,
) => BaseSearchQueryParams & OptionalSearchQueryParams;

export type SearchQueryFunction<T> = (
  accountSid: HrmAccountId,
  searchParameters: T,
  limit: number,
  offset: number,
  user: TwilioUser,
  viewPermissions: TKConditionsSets<'contact'>,
) => Promise<{ rows: Contact[]; count: number }>;

const generalizedSearchQueryFunction = <T>(
  sqlQueryGenerator: (
    viewPermissions: TKConditionsSets<'contact'>,
    userIsSupervisor: boolean,
  ) => string,
  sqlQueryParamsBuilder: SearchQueryParamsBuilder<T>,
): SearchQueryFunction<T> => {
  return async (accountSid, searchParameters, limit, offset, user, viewPermissions) => {
    return db.task(async connection => {
      const searchResults: (Contact & { totalCount: number })[] =
        await connection.manyOrNone<Contact & { totalCount: number }>(
          sqlQueryGenerator(viewPermissions, user.isSupervisor),
          sqlQueryParamsBuilder(accountSid, user, searchParameters, limit, offset),
        );
      return {
        rows: searchResults,
        count: searchResults.length ? searchResults[0].totalCount : 0,
      };
    });
  };
};

export const search: SearchQueryFunction<SearchParameters> =
  generalizedSearchQueryFunction(selectContactSearch, searchParametersToQueryParameters);

export const searchByProfileId: SearchQueryFunction<
  Pick<OptionalSearchQueryParams, 'counselor' | 'helpline'> & { profileId: number }
> = generalizedSearchQueryFunction(
  selectContactsByProfileId,
  (accountSid, { workerSid }, searchParameters, limit, offset) => ({
    accountSid,
    twilioWorkerSid: workerSid,
    limit,
    offset,
    counselor: searchParameters.counselor,
    helpline: searchParameters.helpline,
    profileId: searchParameters.profileId,
  }),
);

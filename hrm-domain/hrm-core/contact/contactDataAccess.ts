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

import { getDbForAccount, getDbForAdmin, pgp } from '../dbConnection';
import {
  selectContactsByProfileId,
  getContactsByIds,
  SELECT_CONTACTS_TO_RENOTIFY,
} from './sql/contactSearchSql';
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
import QueryStream from 'pg-query-stream';

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

export type ContactRecord = Omit<Contact, 'id' | 'caseId'> & {
  id: number;
  caseId?: number;
};

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
  llmSupportedEntries: undefined,
  hangUpBy: undefined,
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

type SearchParametersForQueryParameters = {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  dateFrom?: string;
  dateTo?: string;
  contactNumber?: string;
  helpline?: string;
  counselor?: string;
};

type CreateResultRecord = ContactRecord & { isNewRecord: boolean };
type CreateResult = { contact: ContactRecord; isNewRecord: boolean };

export const create =
  (task?) =>
  async (
    accountSid: HrmAccountId,
    newContact: NewContactRecord,
  ): Promise<Result<DatabaseErrorResult, CreateResult>> => {
    try {
      return newOkFromData(
        await txIfNotInOne(
          await getDbForAccount(accountSid),
          task,
          async (conn: ITask<{ contact: ContactRecord; isNewRecord: boolean }>) => {
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
  ): Promise<ContactRecord | undefined> => {
    return txIfNotInOne(await getDbForAccount(accountSid), task, async connection => {
      const updatedContact: ContactRecord = await connection.oneOrNone<ContactRecord>(
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
  ): Promise<ContactRecord | undefined> => {
    return txIfNotInOne(await getDbForAccount(accountSid), task, async connection => {
      const [[updatedContact]]: ContactRecord[][] = await connection.multi<ContactRecord>(
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
): Promise<ContactRecord> =>
  (await getDbForAccount(accountSid)).task(async connection =>
    connection.oneOrNone<ContactRecord>(selectSingleContactByIdSql('Contacts'), {
      accountSid,
      contactId,
    }),
  );

export const getByTaskSid = async (
  accountSid: HrmAccountId,
  taskId: string,
): Promise<ContactRecord> =>
  (await getDbForAccount(accountSid)).task(async connection =>
    connection.oneOrNone<ContactRecord>(selectSingleContactByTaskId('Contacts'), {
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
) => Promise<{ rows: ContactRecord[]; count: number }>;

const generalizedSearchQueryFunction = <T>(
  sqlQueryGenerator: (
    viewPermissions: TKConditionsSets<'contact'>,
    userIsSupervisor: boolean,
  ) => string,
  sqlQueryParamsBuilder: SearchQueryParamsBuilder<T>,
): SearchQueryFunction<T> => {
  return async (accountSid, searchParameters, limit, offset, user, viewPermissions) => {
    return (await getDbForAccount(accountSid)).task(async connection => {
      const searchResults: (ContactRecord & { totalCount: number })[] =
        await connection.manyOrNone<ContactRecord & { totalCount: number }>(
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

export const searchByProfileId: SearchQueryFunction<
  Pick<OptionalSearchQueryParams, 'counselor' | 'helpline'> & { profileId: number }
> = generalizedSearchQueryFunction(
  selectContactsByProfileId,
  (accountSid, { workerSid }, searchParameters, limit, offset) => {
    return {
      accountSid,
      twilioWorkerSid: workerSid,
      limit,
      offset,
      counselor: searchParameters.counselor,
      helpline: searchParameters.helpline,
      profileId: searchParameters.profileId,
    };
  },
);

export const searchByIds: SearchQueryFunction<
  Pick<OptionalSearchQueryParams, 'counselor'> & {
    contactIds: ContactRecord['id'][];
  }
> = generalizedSearchQueryFunction(
  getContactsByIds,
  (accountSid, { workerSid }, searchParameters, limit, offset) => ({
    accountSid,
    twilioWorkerSid: workerSid,
    limit,
    offset,
    counselor: searchParameters.counselor,
    contactIds: searchParameters.contactIds,
  }),
);

export const streamContactsAfterNotified = ({
  accountSid,
  searchParameters,
  batchSize = 1000,
}: {
  accountSid: HrmAccountId;
  searchParameters: NonNullable<
    Pick<SearchParametersForQueryParameters, 'dateFrom' | 'dateTo'>
  >;
  batchSize?: number;
}): Promise<NodeJS.ReadableStream> => {
  const qs = new QueryStream(
    pgp.as.format(SELECT_CONTACTS_TO_RENOTIFY, {
      accountSid,
      dateFrom: parseISO(searchParameters.dateFrom).toISOString(),
      dateTo: parseISO(searchParameters.dateTo).toISOString(),
    }),
    [],
    {
      batchSize,
    },
  );
  // Expose the readable stream to the caller as a promise for further pipelining
  return new Promise(resolve => {
    Promise.resolve(getDbForAdmin()).then(db =>
      db.stream(qs, resultStream => {
        resolve(resultStream);
      }),
    );
  });
};

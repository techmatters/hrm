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

import type { Contact } from '@tech-matters/hrm-types';
import { callHrmApi } from '@tech-matters/hrm-authentication';
import { isErr, newErr } from '@tech-matters/types';

export const connectToCase = async ({
  accountSid,
  caseId,
  contactId,
  baseUrl,
  token,
}: {
  accountSid: string;
  caseId: string;
  contactId: string;
  baseUrl: string;
  token: string;
}) => {
  try {
    // TODO?: set api version via env vars
    const urlPath = `v0/accounts/${accountSid}/contacts/${contactId}/connectToCase`;
    const authHeader = `Bearer ${token}`;

    const result = await callHrmApi<Contact>(baseUrl)({
      urlPath,
      authHeader,
      method: 'PUT',
      body: { caseId },
    });

    if (isErr(result)) {
      return result;
    }

    return result;
  } catch (err) {
    return newErr({
      error: err,
      message: `Unexpected error ${err instanceof Error ? err.message : String(err)}`,
    });
  }
};

export const getContact = async ({
  accountSid,
  contactId,
  baseUrl,
  token,
}: {
  accountSid: string;
  contactId: string;
  baseUrl: string;
  token: string;
}) => {
  try {
    // TODO?: set api version via env vars
    const urlPath = `v0/accounts/${accountSid}/contacts/${contactId}`;
    const authHeader = `Bearer ${token}`;

    const result = await callHrmApi<Contact>(baseUrl)({
      urlPath,
      authHeader,
      method: 'GET',
    });

    if (isErr(result)) {
      return result;
    }

    return result;
  } catch (err) {
    return newErr({
      error: err,
      message: `Unexpected error ${err instanceof Error ? err.message : String(err)}`,
    });
  }
};

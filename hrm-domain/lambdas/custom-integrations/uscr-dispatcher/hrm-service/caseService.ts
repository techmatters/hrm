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

import type { CaseService } from '@tech-matters/hrm-types';
import { callHrmApi } from '@tech-matters/hrm-authentication';
import { isErr, newErr } from '@tech-matters/types';

export const createCase = async ({
  accountSid,
  casePayload,
  token,
}: {
  accountSid: string;
  casePayload: Partial<CaseService>;
  token: string;
}) => {
  try {
    // TODO?: set api version via env vars
    const urlPath = `v0/accounts/${accountSid}/cases`;
    const authHeader = `Bearer ${token}`;

    const result = await callHrmApi<CaseService>({
      urlPath,
      authHeader,
      method: 'POST',
      body: casePayload,
    });

    if (isErr(result)) {
      return newErr({
        error: `createCase error: ${result.error} `,
        message: result.message,
      });
    }

    return result;
  } catch (err) {
    return newErr({
      error: 'createCase error: ',
      message: `Unexpected error ${err instanceof Error ? err.message : String(err)}`,
    });
  }
};

export const getCase = async ({
  accountSid,
  caseId,
  token,
}: {
  accountSid: string;
  caseId: string;
  token: string;
}) => {
  try {
    const urlPath = `v0/accounts/${accountSid}/cases/${caseId}`;

    const authHeader = `Bearer ${token}`;

    const result = await callHrmApi<CaseService>({
      urlPath,
      authHeader,
      method: 'GET',
    });

    if (isErr(result)) {
      return newErr({
        error: `getCase error: ${result.error} `,
        message: result.message,
      });
    }

    return result;
  } catch (err) {
    return newErr({
      error: 'getCase error: ',
      message: `Unexpected error ${err instanceof Error ? err.message : String(err)}`,
    });
  }
};

export const deleteCase = async ({
  accountSid,
  caseId,
  token,
}: {
  accountSid: string;
  caseId: string;
  token: string;
}) => {
  try {
    const urlPath = `v0/accounts/${accountSid}/cases/${caseId}`;

    const authHeader = `Bearer ${token}`;

    const result = await callHrmApi<CaseService>({
      urlPath,
      authHeader,
      method: 'DELETE',
    });

    if (isErr(result)) {
      return newErr({
        error: `deleteCase error: ${result.error} `,
        message: result.message,
      });
    }

    return result;
  } catch (err) {
    return newErr({
      error: 'deleteCase error: ',
      message: `Unexpected error ${err instanceof Error ? err.message : String(err)}`,
    });
  }
};

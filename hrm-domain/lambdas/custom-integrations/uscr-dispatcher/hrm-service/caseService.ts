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

import type {
  CaseService,
  CaseSection,
  TimelineApiResponse,
} from '@tech-matters/hrm-types';
import { callHrmApi } from '@tech-matters/hrm-authentication';
import { isErr, newErr } from '@tech-matters/types';

export const createCase = async ({
  accountSid,
  casePayload,
  baseUrl,
  staticKey,
}: {
  accountSid: string;
  casePayload: Partial<CaseService>;
  baseUrl: string;
  staticKey: string;
}) => {
  try {
    // TODO?: set api version via env vars
    const urlPath = `/internal/v0/accounts/${accountSid}/cases`;
    const authHeader = `Basic ${staticKey}`;

    const result = await callHrmApi<CaseService>(baseUrl)({
      urlPath,
      authHeader,
      method: 'POST',
      body: casePayload,
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

export const getCase = async ({
  accountSid,
  caseId,
  baseUrl,
  staticKey,
}: {
  accountSid: string;
  caseId: CaseService['id'];
  baseUrl: string;
  staticKey: string;
}) => {
  try {
    const urlPath = `/internal/v0/accounts/${accountSid}/cases/${caseId}`;

    const authHeader = `Basic ${staticKey}`;

    const result = await callHrmApi<CaseService>(baseUrl)({
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

export const deleteCase = async ({
  accountSid,
  caseId,
  baseUrl,
  staticKey,
}: {
  accountSid: string;
  caseId: CaseService['id'];
  baseUrl: string;
  staticKey: string;
}) => {
  try {
    const urlPath = `/internal/v0/accounts/${accountSid}/cases/${caseId}`;

    const authHeader = `Basic ${staticKey}`;

    const result = await callHrmApi<CaseService>(baseUrl)({
      urlPath,
      authHeader,
      method: 'DELETE',
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

export const createCaseSection = async ({
  accountSid,
  caseId,
  sectionType,
  sectionTypeSpecificData,
  baseUrl,
  staticKey,
}: {
  accountSid: string;
  caseId: CaseService['id'];
  sectionType: CaseSection['sectionType'];
  sectionTypeSpecificData: CaseSection['sectionTypeSpecificData'];
  baseUrl: string;
  staticKey: string;
}) => {
  try {
    const urlPath = `/internal/v0/accounts/${accountSid}/cases/${caseId}/sections/${sectionType}`;

    const authHeader = `Basic ${staticKey}`;

    const result = await callHrmApi<CaseSection>(baseUrl)({
      urlPath,
      authHeader,
      method: 'POST',
      body: { sectionTypeSpecificData },
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

export const updateCaseSection = async ({
  accountSid,
  caseId,
  sectionId,
  sectionType,
  sectionTypeSpecificData,
  baseUrl,
  staticKey,
}: {
  accountSid: string;
  caseId: CaseService['id'];
  sectionId: CaseSection['sectionId'];
  sectionType: CaseSection['sectionType'];
  sectionTypeSpecificData: CaseSection['sectionTypeSpecificData'];
  baseUrl: string;
  staticKey: string;
}) => {
  try {
    const urlPath = `/internal/v0/accounts/${accountSid}/cases/${caseId}/sections/${sectionType}/${sectionId}`;

    const authHeader = `Basic ${staticKey}`;

    const result = await callHrmApi<CaseSection>(baseUrl)({
      urlPath,
      authHeader,
      method: 'PUT',
      body: { sectionTypeSpecificData },
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

export const getCaseSections = async ({
  accountSid,
  caseId,
  sectionType,
  baseUrl,
  staticKey,
}: {
  accountSid: string;
  caseId: CaseService['id'];
  sectionType: CaseSection['sectionType'];
  baseUrl: string;
  staticKey: string;
}) => {
  try {
    const urlPath = `/internal/v0/accounts/${accountSid}/cases/${caseId}/timeline?sectionTypes=${sectionType}&includeContacts=false`;

    const authHeader = `Basic ${staticKey}`;

    const result = await callHrmApi<TimelineApiResponse>(baseUrl)({
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

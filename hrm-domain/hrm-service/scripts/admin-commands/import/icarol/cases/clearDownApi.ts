/**
 * Copyright (C) 2021-2026 Technology Matters
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
import type { AccountSID } from '@tech-matters/types';
import { getAdminV0URL } from '../../../../hrmInternalConfig';

type AdminAuth = { internalResourcesUrl: URL; accountSid: AccountSID; authKey: string };

export const getContactById = async (
  { internalResourcesUrl, accountSid, authKey }: AdminAuth,
  contactId: string,
): Promise<{ id: string; caseId?: string | null }> => {
  const url = getAdminV0URL(internalResourcesUrl, accountSid, `/contacts/${contactId}`);
  const response = await fetch(url, { headers: { Authorization: `Basic ${authKey}` } });
  if (!response.ok) {
    throw new Error(
      `Failed to fetch contact ${contactId}: HTTP ${response.status} ${response.statusText}`,
    );
  }
  return response.json();
};

export const getCaseById = async (
  { internalResourcesUrl, accountSid, authKey }: AdminAuth,
  caseId: string,
): Promise<{
  id: string;
  createdBy: string | null;
  updatedBy: string | null;
} | null> => {
  const url = getAdminV0URL(internalResourcesUrl, accountSid, `/cases/${caseId}`);
  const response = await fetch(url, { headers: { Authorization: `Basic ${authKey}` } });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(
      `Failed to fetch case ${caseId}: HTTP ${response.status} ${response.statusText}`,
    );
  }
  return response.json();
};

const SYSTEM_IDENTITY = 'system';

/**
 * True if a Case still looks untouched by a real user. createdAt/updatedAt
 * can't be used for this: connectToCase bumps updatedAt on every link,
 * including this migration's own, so every case would fail that check the
 * moment it's actually used. updatedBy survives linking instead: create()
 * never sets it, and admin-path connectToCase calls always set it to
 * 'system'; only a real counsellor action sets a real workerSid. A touched
 * CaseSection also bumps updatedBy the same way, so no separate check for
 * that is needed.
 */
export const looksUntouchedSinceImport = (liveCase: {
  updatedBy: string | null;
}): boolean => !liveCase.updatedBy || liveCase.updatedBy === SYSTEM_IDENTITY;

/**
 * True if this Case was created by the migration itself, not a counsellor.
 * Used before reconnecting sibling contacts to an existing caseId, so a
 * contact that somehow got linked to a real, human-created case is never
 * silently touched.
 */
export const wasCreatedByImport = (liveCase: { createdBy: string | null }): boolean =>
  liveCase.createdBy === SYSTEM_IDENTITY;

/**
 * Uses the existing connectToCase route with caseId: null, which
 * connectContactToCase already treats as a disconnect. No new route needed.
 */
export const unlinkContactFromCase = async (
  { internalResourcesUrl, accountSid, authKey }: AdminAuth,
  contactId: string,
): Promise<void> => {
  const url = getAdminV0URL(
    internalResourcesUrl,
    accountSid,
    `/contacts/${contactId}/connectToCase`,
  );
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Basic ${authKey}` },
    body: JSON.stringify({ caseId: null }),
  });
  if (!response.ok) {
    throw new Error(
      `Failed to unlink contact ${contactId}: HTTP ${response.status} ${response.statusText}`,
    );
  }
};

// Thrown when a case delete is rejected because a contact is still linked,
// so callers can tell this apart from a genuine failure.
export class CaseStillLinkedError extends Error {}

export const deleteCaseById = async (
  { internalResourcesUrl, accountSid, authKey }: AdminAuth,
  caseId: string,
): Promise<void> => {
  const url = getAdminV0URL(internalResourcesUrl, accountSid, `/cases/${caseId}`);
  const response = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Basic ${authKey}` },
  });
  if (response.status === 409) {
    throw new CaseStillLinkedError(`Case ${caseId} still has linked contacts`);
  }
  if (!response.ok) {
    throw new Error(
      `Failed to delete case ${caseId}: HTTP ${response.status} ${response.statusText}`,
    );
  }
};

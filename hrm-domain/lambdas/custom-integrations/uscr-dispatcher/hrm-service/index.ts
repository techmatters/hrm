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

import type { CaseService, Contact } from '@tech-matters/hrm-types';
import { createCase, deleteCase, getCase } from './caseService';
import { connectToCase, getContact } from './contactService';
import { isErr, newErr, newOk, TResult } from '@tech-matters/types';
import { logger } from '../logger';

export const getOrCreateCase = async ({
  accountSid,
  casePayload,
  contactId,
  token,
}: {
  accountSid: string;
  casePayload: Partial<CaseService>;
  contactId: string;
  token: string;
}): Promise<TResult<string, { caseObj: CaseService; contact: Contact }>> => {
  // get contact and check for existence of an associated case
  const contactResult = await getContact({ accountSid, contactId, token });
  if (isErr(contactResult)) {
    return newErr({
      error: `createAndConnectCase: ${contactResult.error}`,
      message: contactResult.message,
    });
  }

  if (contactResult.data.caseId) {
    const caseResult = await getCase({
      accountSid,
      caseId: contactResult.data.caseId.toString(),
      token,
    });
    if (isErr(caseResult)) {
      return newErr({
        error: `createAndConnectCase: ${caseResult.error}`,
        message: caseResult.message,
      });
    }

    // TODO: check if incident has already been dispatched. While Beacon idempotence on contact id should prevent this scenario, won't harm having it here too
    logger({ message: `Case exists: ${JSON.stringify(caseResult)}`, severity: 'info' });

    return newOk({
      data: { caseObj: caseResult.data, contact: contactResult.data },
    });
  }

  // no case associated, create and associate one
  const caseResult = await createCase({ accountSid, casePayload, token });
  if (isErr(caseResult)) {
    return newErr({
      error: `createAndConnectCase: ${caseResult.error}`,
      message: caseResult.message,
    });
  }

  logger({ message: `Case created: ${JSON.stringify(caseResult)}`, severity: 'info' });

  const caseObj = caseResult.data;
  const caseId = caseObj.id.toString();

  const connectedResult = await connectToCase({
    accountSid,
    caseId,
    contactId,
    token,
  });
  if (isErr(connectedResult)) {
    const deleteResult = await deleteCase({
      accountSid,
      caseId,
      token,
    });

    if (isErr(deleteResult)) {
      const message = deleteResult.error + deleteResult.message;
      logger({ message, severity: 'error' });
    }

    return newErr({
      error: `createAndConnectCase: ${connectedResult.error}`,
      message: connectedResult.message,
    });
  }

  return newOk({ data: { caseObj, contact: connectedResult.data } });
};

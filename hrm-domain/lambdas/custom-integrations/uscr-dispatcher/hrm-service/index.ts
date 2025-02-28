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
import { createCase, deleteCase } from './caseService';
import { connectToCase } from './contactService';
import { isErr, newErr, newOk } from '@tech-matters/types';
import { logger } from '../logger';

export const createAndConnectCase = async ({
  accountSid,
  casePayload,
  contactId,
  token,
}: {
  accountSid: string;
  casePayload: Partial<CaseService>;
  contactId: string;
  token: string;
}) => {
  const caseResult = await createCase({ accountSid, casePayload, token });
  if (isErr(caseResult)) {
    return newErr({
      error: `createAndConnectCase: ${caseResult.error}`,
      message: caseResult.message,
    });
  }

  const createdCase = caseResult.data;
  const caseId = createdCase.id.toString();

  const contactResult = await connectToCase({
    accountSid,
    caseId,
    contactId,
    token,
  });
  if (isErr(contactResult)) {
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
      error: `createAndConnectCase: ${contactResult.error}`,
      message: contactResult.message,
    });
  }

  return newOk({ data: { createdCase, contact: contactResult.data } });
};

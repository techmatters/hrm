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

import { newErr, newOk } from '@tech-matters/types';
import { CaseService } from '@tech-matters/hrm-types';

export const validateEnvironment = () => {
  const environment = process.env.NODE_ENV;
  if (!environment) {
    return newErr({
      error: 'Environment validation failed',
      message: 'NODE_ENV variable missing',
    });
  }

  const hrmInternalUrl = process.env.INTERNAL_HRM_URL;
  if (!hrmInternalUrl) {
    return newErr({
      error: 'Environment validation failed',
      message: 'HRM_BASE_URL variable missing',
    });
  }

  return newOk({ data: { environment, baseUrl: hrmInternalUrl } });
};

export const validatePayload = ({
  accountSid,
  casePayload,
  contactId,
}: {
  accountSid?: string;
  casePayload?: Partial<CaseService>;
  contactId?: string;
}) => {
  if (!accountSid) {
    return newErr({
      error: 'Payload validation failed',
      message: 'accountSid parameter missing',
    });
  }

  if (!casePayload) {
    return newErr({
      error: 'Payload validation failed',
      message: 'casePayload parameter missing',
    });
  }

  if (!contactId) {
    return newErr({
      error: 'Payload validation failed',
      message: 'contactId parameter missing',
    });
  }

  return newOk({ data: { accountSid, casePayload, contactId } });
};

export const validateHeaders = (headers: { authorization?: string } | undefined) => {
  if (!headers) {
    return newErr({
      error: 'Headers validation failed',
      message: 'no headers provided',
    });
  }

  if (!headers.authorization) {
    return newErr({
      error: 'Headers validation failed',
      message: 'no authorization header provided',
    });
  }

  return newOk({ data: { authToken: headers.authorization } });
};

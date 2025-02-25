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

// eslint-disable-next-line prettier/prettier
import type { ALBEvent, ALBResult } from 'aws-lambda';
import { isErr } from '@tech-matters/types';
import { validateEnvironment, validateHeaders, validatePayload } from './validation';
import { authenticateRequest } from './authentication';
import { logger } from './logger';
import { createAndConnectCase } from './hrm-service/integrationService';

export const handler = async (event: ALBEvent): Promise<ALBResult> => {
  try {
    console.log(JSON.stringify(event));
    const envResult = validateEnvironment();
    if (isErr(envResult)) {
      const message = `${envResult.error} ${envResult.message}`;
      logger({ message, severity: 'error' });
      return { statusCode: 500, body: message };
    }

    const payloadResult = validatePayload(JSON.parse(event.body || '{}'));
    if (isErr(payloadResult)) {
      const message = `${payloadResult.error} ${payloadResult.message}`;
      logger({ message, severity: 'warn' });
      return { statusCode: 400, body: message };
    }

    const headersResult = validateHeaders(event.headers);
    if (isErr(headersResult)) {
      const message = `${headersResult.error} ${headersResult.message}`;
      logger({ message, severity: 'warn' });
      return { statusCode: 400 };
    }

    const authResult = await authenticateRequest({
      accountSid: payloadResult.data.accountSid,
      authHeader: headersResult.data.authToken,
      environment: envResult.data.environment,
    });

    if (isErr(authResult)) {
      const message = authResult.error + authResult.message;
      logger({ message, severity: 'warn' });
      return { statusCode: 401 };
    }

    const createResult = await createAndConnectCase({
      accountSid: payloadResult.data.accountSid,
      casePayload: payloadResult.data.casePayload,
      contactId: payloadResult.data.contactId,
      token: authResult.data.token,
    });

    if (isErr(createResult)) {
      const message = createResult.error + createResult.message;
      logger({ message, severity: 'error' });
      return { statusCode: 500 };
    }

    logger({ message: JSON.stringify(createResult), severity: 'info' });

    logger({ message: 'succesful execution', severity: 'info' });
    return {
      statusCode: 200,
    };
  } catch (err) {
    logger({
      message: err instanceof Error ? err.message : String(err),
      severity: 'error',
    });

    return { statusCode: 500 };
  }
};

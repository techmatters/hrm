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

import { isErr, newErr, newOk, TResult } from '@tech-matters/types';
import { validatePayload } from './validation';
import * as hrmService from './hrm-service';
import * as beaconService from './beacon-service';
import { getSsmParameter } from '@tech-matters/ssm-cache';
import {
  handleAlbEvent,
  AlbHandlerEvent,
  AlbHandlerResult,
} from '@tech-matters/alb-handler';
import { twilioTokenValidator } from '@tech-matters/twilio-worker-auth';
import { newCreateIncidentMapper } from './mapping';

type DispatcherError =
  | 'ValidationError'
  | 'AuthenticationError'
  | 'BeaconServiceError'
  | 'HrmServiceError';

const EXTRACT_HELPLINE_CODE_FROM_PATH =
  /.*custom-integrations\/beacon\/dispatcher\/(?<helplineCode>[A-Za-z0-9]+)/g;

const postHandler = async (
  event: AlbHandlerEvent,
): Promise<
  TResult<
    DispatcherError,
    {
      caseId: string;
      incidentId?: number;
      pendingIncidentId: number;
      status: 'exists' | 'success';
    }
  >
> => {
  const environment = process.env.NODE_ENV;
  if (!environment) {
    const message = 'NODE_ENV variable missing';
    console.error(message);
    return newErr({ error: 'ValidationError', message });
  }

  const hrmInternalUrl = process.env.INTERNAL_HRM_URL;
  if (!hrmInternalUrl) {
    const message = 'INTERNAL_HRM_URL variable missing';
    console.error(message);
    return newErr({ error: 'ValidationError', message });
  }

  // Extract accountSid from the last segment of the path
  const pathMatch = event.path.match(EXTRACT_HELPLINE_CODE_FROM_PATH);
  const helplineCode = pathMatch?.groups?.helplineCode;

  // Parse request body
  let body: any;
  try {
    body = JSON.parse(event.body ?? '{}');
  } catch {
    return newErr({ error: 'ValidationError', message: 'Invalid JSON body' });
  }

  // Legacy API didn't provide a short code and put the account SID in the body. New API has the short code in the path and no account sid
  const accountSid = helplineCode
    ? await getSsmParameter(
        `/${environment}/twilio/${helplineCode.toUpperCase()}/account_sid`,
      )
    : body.accountSid;

  const payloadResult = validatePayload({
    casePayload: body.casePayload,
    contactId: body.contactId,
  });

  if (isErr(payloadResult)) {
    const message = `${JSON.stringify(payloadResult.error)} ${payloadResult.message}`;
    console.error(message);
    return newErr({ error: 'ValidationError', message });
  }
  // Validate Twilio worker token
  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  const token = authHeader?.replace(/^Bearer\s+/i, '');
  if (!token) {
    return newErr({
      error: 'AuthenticationError',
      message: 'Missing Authorization header',
    });
  }

  const authToken = await getSsmParameter(
    `/${environment}/twilio/${accountSid}/auth_token`,
  );
  const tokenValidationResult = await twilioTokenValidator({
    accountSid,
    authToken,
    token,
  });
  if (isErr(tokenValidationResult)) {
    return newErr({
      error: 'AuthenticationError',
      message: tokenValidationResult.message,
    });
  }

  const staticKey = await getSsmParameter(
    `/${environment}/twilio/${accountSid}/static_key`,
  );

  const { casePayload, contactId } = payloadResult.data;

  // Get (or create) case associated with the contact so we can track the incident being reported
  const createCaseResult = await hrmService.getOrCreateCase({
    accountSid,
    casePayload,
    contactId,
    baseUrl: hrmInternalUrl,
    staticKey,
  });
  if (isErr(createCaseResult)) {
    const message = JSON.stringify(createCaseResult.error) + createCaseResult.message;
    console.error(message);
    return newErr({ error: 'HrmServiceError', message });
  }

  const { contact, caseObj, sections } = createCaseResult.data;

  // Case already contains a corresponding case entry section, we assume the incident has been created but something went wrong updating HRM. Poller will eventually bring consistency to this case
  const existingIncident = hrmService.existingPendingIncident(sections.sections);
  if (existingIncident) {
    console.info('case already has associated incident');
    return newOk({
      data: {
        status: 'exists',
        caseId: caseObj.id,
        pendingIncidentId: existingIncident.incidentId,
      },
    });
  }

  const incidentParams = newCreateIncidentMapper(helplineCode)({
    caseObj: caseObj,
    contact,
  });

  console.info(`Creating incident with the following data:`, incidentParams);

  // Case does not contains a corresponding case entry section, we assume the incident was never reported (this can only happen if Beacon responded with an error)
  const createIncidentResult = await beaconService.createIncident({
    environment,
    helplineShortCode: helplineCode?.toLowerCase() ?? 'uscr', // Legacy API only looked for creds under USCR
    incidentParams,
  });
  if (isErr(createIncidentResult)) {
    const message =
      JSON.stringify(createIncidentResult.error) + createIncidentResult.message;
    console.error(message);
    return newErr({ error: 'BeaconServiceError', message });
  }

  console.debug(JSON.stringify(createIncidentResult));

  // Create incident case section to mark this case as "already reported"
  const updateSectionResult = await hrmService.updateAttemptCaseSection({
    accountSid,
    beaconIncidentId: createIncidentResult.data.pending_incident.id,
    caseId: caseObj.id,
    attemptSection: sections.currentAttempt.caseSection,
    baseUrl: hrmInternalUrl,
    staticKey,
  });
  if (isErr(updateSectionResult)) {
    const message =
      JSON.stringify(updateSectionResult.error) + updateSectionResult.message;
    console.error(message);
    return newErr({ error: 'HrmServiceError', message });
  }

  const {
    pending_incident: { id: pendingIncidentId },
    incident: { id: incidentId },
    status,
  } = createIncidentResult.unwrap();
  console.info(
    `${
      status === 'success' ? 'new incident reported' : 'incident already exists'
    }, incident id ${pendingIncidentId}, case id ${caseObj.id}`,
  );
  return newOk({
    data: {
      caseId: caseObj.id,
      pendingIncidentId,
      incidentId,
      status,
    },
  });
};

export const handler = async (event: AlbHandlerEvent): Promise<AlbHandlerResult> => {
  return handleAlbEvent({
    event,
    methodHandlers: { POST: postHandler },
    mapError: {
      ValidationError: 400,
      AuthenticationError: 401,
      BeaconServiceError: 500,
      HrmServiceError: 500,
    },
  });
};

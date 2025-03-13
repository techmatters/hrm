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

import { isErr, newErr, newOk } from '@tech-matters/types';
import { validateEnvironment, validateHeaders, validatePayload } from './validation';
import { authenticateRequest } from './authentication';
import * as hrmService from './hrm-service';
import * as beaconService from './beacon-service';
import * as mapping from './mapping';
import {
  AlbHandlerEvent,
  AlbHandlerResult,
  handleAlbEvent,
} from '@tech-matters/alb-handler';

export const postHandler = async (event: AlbHandlerEvent) => {
  try {
    console.log(JSON.stringify(event));
    const envResult = validateEnvironment();
    if (isErr(envResult)) {
      const message = `${JSON.stringify(envResult.error)} ${envResult.message}`;
      console.error(message);
      return newErr({ error: 'InternalServerError', message });
    }

    const payloadResult = validatePayload(JSON.parse(event.body || '{}'));
    if (isErr(payloadResult)) {
      const message = `${JSON.stringify(payloadResult.error)} ${payloadResult.message}`;
      console.warn(message);
      return newErr({ error: 'InvalidRequestError', message });
    }

    const headersResult = validateHeaders(event.headers);
    if (isErr(headersResult)) {
      const message = `${JSON.stringify(headersResult.error)} ${headersResult.message}`;
      console.warn(message);
      return newErr({ error: 'InvalidRequestError', message });
    }

    const authResult = await authenticateRequest({
      accountSid: payloadResult.data.accountSid,
      authHeader: headersResult.data.authToken,
      environment: envResult.data.environment,
    });
    if (isErr(authResult)) {
      const message = JSON.stringify(authResult.error) + authResult.message;
      console.warn(message);
      return newErr({ error: 'AuthError', message });
    }

    // Get (or create) case associated with the contact so we can track the incident being reported
    const createCaseResult = await hrmService.getOrCreateCase({
      accountSid: payloadResult.data.accountSid,
      casePayload: payloadResult.data.casePayload,
      contactId: payloadResult.data.contactId,
      baseUrl: envResult.data.baseUrl,
      token: authResult.data.token,
    });
    if (isErr(createCaseResult)) {
      const message = JSON.stringify(createCaseResult.error) + createCaseResult.message;
      console.error(message);
      return newErr({ error: 'InternalServerError', message });
    }

    const { contact, caseObj, sections } = createCaseResult.data;

    // Case already contains a corresponding case entry section, we asume the incident has been created but something went wrong updating HRM. Poller will eventually bring consitency to this case
    if (hrmService.wasPendingIncidentCreated(sections.sections)) {
      console.info('case already has associated incident');
      return newOk({ data: {} });
    }

    // Case does not contains a corresponding case entry section, we assume the incident was never reported (this can only happen if Beacon responded with an error)
    const createIncidentResult = await beaconService.createIncident({
      environment: envResult.data.environment,
      incidentParams: mapping.toCreateIncident({
        caseObj: caseObj,
        contact,
      }),
    });
    if (isErr(createIncidentResult)) {
      const message =
        JSON.stringify(createIncidentResult.error) + createIncidentResult.message;
      console.error(message);
      return newErr({ error: 'InternalServerError', message });
    }

    console.debug(JSON.stringify(createIncidentResult));

    // Create incident case section to mark this case as "already reported"
    const updateSectionResult = await hrmService.updateAttemptCaseSection({
      accountSid: payloadResult.data.accountSid,
      beaconIncidentId: createIncidentResult.data.pending_incident.id,
      caseId: caseObj.id,
      attemptSection: sections.currentAttempt.caseSection,
      baseUrl: envResult.data.baseUrl,
      token: authResult.data.token,
    });
    if (isErr(updateSectionResult)) {
      const message =
        JSON.stringify(updateSectionResult.error) + updateSectionResult.message;
      console.error(message);
      return newErr({ error: 'InternalServerError', message });
    }

    console.info(
      `new incident reported, incident id ${createIncidentResult.data.pending_incident.id}, case id ${caseObj.id}`,
    );
    return newOk({ data: {} });
  } catch (err) {
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    console.error(message);
    return newErr({ error: 'InternalServerError', message });
  }
};

const methodHandlers = {
  POST: postHandler,
};

export const handler = async (event: AlbHandlerEvent): Promise<AlbHandlerResult> => {
  return handleAlbEvent({
    event,
    methodHandlers,
    mapError: {
      InvalidRequestError: 400,
      AuthError: 401,
      InternalServerError: 500,
    },
  });
};

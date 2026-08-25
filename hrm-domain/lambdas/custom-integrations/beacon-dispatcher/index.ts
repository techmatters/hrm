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

import { isErr } from '@tech-matters/types';
import { validatePayload } from './validation';
import * as hrmService from './hrm-service';
import * as beaconService from './beacon-service';
import * as mapping from './mapping';
import { getSsmParameter } from '@tech-matters/ssm-cache';
import { CaseService } from '@tech-matters/hrm-types';

export type BeaconDispatcherEvent = {
  helplineShortCode: string;
  casePayload?: Partial<CaseService>;
  contactId?: string;
};

export const handler = async (event: BeaconDispatcherEvent) => {
  const environment = process.env.NODE_ENV;
  if (!environment) {
    const message = 'NODE_ENV variable missing';
    console.error(message);
    throw new Error(message);
  }

  const hrmInternalUrl = process.env.INTERNAL_HRM_URL;
  if (!hrmInternalUrl) {
    const message = 'INTERNAL_HRM_URL variable missing';
    console.error(message);
    throw new Error(message);
  }

  const { helplineShortCode } = event;
  if (!helplineShortCode) {
    const message = 'helplineShortCode parameter missing from event';
    console.error(message);
    throw new Error(message);
  }

  const payloadResult = validatePayload({
    casePayload: event.casePayload,
    contactId: event.contactId,
  });
  if (isErr(payloadResult)) {
    const message = `${JSON.stringify(payloadResult.error)} ${payloadResult.message}`;
    console.error(message);
    throw new Error(message);
  }

  const accountSid = await getSsmParameter(
    `/${environment}/twilio/${helplineShortCode}/account_sid`,
  );
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
    throw new Error(message);
  }

  const { contact, caseObj, sections } = createCaseResult.data;

  // Case already contains a corresponding case entry section, we asume the incident has been created but something went wrong updating HRM. Poller will eventually bring consitency to this case
  if (hrmService.wasPendingIncidentCreated(sections.sections)) {
    console.info('case already has associated incident');
    return;
  }

  const incidentParams = mapping.toCreateIncident({
    caseObj: caseObj,
    contact,
  });

  console.info(`Creating incident with the following data:`, incidentParams);

  // Case does not contains a corresponding case entry section, we assume the incident was never reported (this can only happen if Beacon responded with an error)
  const createIncidentResult = await beaconService.createIncident({
    environment,
    helplineShortCode,
    incidentParams,
  });
  if (isErr(createIncidentResult)) {
    const message =
      JSON.stringify(createIncidentResult.error) + createIncidentResult.message;
    console.error(message);
    throw new Error(message);
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
    throw new Error(message);
  }

  console.info(
    `new incident reported, incident id ${createIncidentResult.data.pending_incident.id}, case id ${caseObj.id}`,
  );
};

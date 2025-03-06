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

import type { CaseSection, CaseService, Contact } from '@tech-matters/hrm-types';
import { createCase, createCaseSection, getCase } from './caseService';
import { connectToCase, getContact } from './contactService';
import { isErr, newErr, newOk, TResult } from '@tech-matters/types';
import { PendingIncident } from '../beacon-service';

export const getOrCreateCase = async ({
  accountSid,
  casePayload,
  contactId,
  baseUrl,
  token,
}: {
  accountSid: string;
  casePayload: Partial<CaseService>;
  contactId: string;
  baseUrl: string;
  token: string;
}): Promise<TResult<any, { caseObj: CaseService; contact: Contact }>> => {
  try {
    // get contact and check for existence of an associated case
    const contactResult = await getContact({ accountSid, contactId, baseUrl, token });
    if (isErr(contactResult)) {
      return contactResult;
    }

    if (contactResult.data.caseId) {
      const caseResult = await getCase({
        accountSid,
        caseId: contactResult.data.caseId.toString(),
        baseUrl,
        token,
      });
      if (isErr(caseResult)) {
        return caseResult;
      }

      console.info(`Case exists: ${JSON.stringify(caseResult)}`);

      return newOk({
        data: { caseObj: caseResult.data, contact: contactResult.data },
      });
    }

    // no case associated, create and associate one
    const caseResult = await createCase({ accountSid, casePayload, baseUrl, token });
    if (isErr(caseResult)) {
      return caseResult;
    }

    console.info(`Case created: ${JSON.stringify(caseResult)}`);

    const caseObj = caseResult.data;
    const caseId = caseObj.id.toString();

    const connectedResult = await connectToCase({
      accountSid,
      caseId,
      contactId,
      baseUrl,
      token,
    });
    if (isErr(connectedResult)) {
      return connectedResult;
    }

    return newOk({ data: { caseObj, contact: connectedResult.data } });
  } catch (error) {
    return newErr({
      error,
      message: `Unexpected error ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
  }
};

export const createIncidentCaseSection = async ({
  accountSid,
  beaconIncidentId,
  caseId,
  baseUrl,
  token,
}: {
  accountSid: string;
  beaconIncidentId: PendingIncident['id'];
  caseId: string;
  baseUrl: string;
  token: string;
}): Promise<TResult<any, { caseSection: CaseSection }>> => {
  try {
    const sectionType = 'incidentReport';
    const sectionTypeSpecificData = { beaconIncidentId };

    const createSectionResult = await createCaseSection({
      accountSid,
      caseId,
      sectionId: beaconIncidentId.toString(),
      sectionType,
      sectionTypeSpecificData,
      baseUrl,
      token,
    });
    if (isErr(createSectionResult)) {
      return createSectionResult;
    }

    return newOk({ data: { caseSection: createSectionResult.data } });
  } catch (error) {
    return newErr({
      error,
      message: `Unexpected error ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
  }
};

export const hasIncidentCaseSection = (caseObj: CaseService) =>
  Boolean(caseObj.sections.incidentReport && caseObj.sections.incidentReport.length);

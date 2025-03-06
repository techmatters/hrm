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

import type { CaseSection, CaseService, TimelineResult } from '@tech-matters/hrm-types';
import {
  createCase,
  createCaseSection,
  deleteCase,
  getCase,
  getCaseSections,
  updateCaseSection,
} from './caseService';
import { connectToCase, getContact } from './contactService';
import { isErr, newErr, newOk } from '@tech-matters/types';
import { PendingIncident } from '../beacon-service';

const sectionType = '__incidentReportAttempt';
type IncidentReportAttempt = {
  attemptTimestamp: string;
  createdTimestamp: string | null;
  incidentId: PendingIncident['id'] | null;
};

export const createAttemptCaseSection = async ({
  accountSid,
  caseId,
  baseUrl,
  token,
}: {
  accountSid: string;
  caseId: CaseService['id'];
  baseUrl: string;
  token: string;
}) => {
  try {
    const sectionTypeSpecificData: IncidentReportAttempt = {
      attemptTimestamp: new Date().toISOString(),
      createdTimestamp: null,
      incidentId: null,
    };

    const createSectionResult = await createCaseSection({
      accountSid,
      caseId,
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

const recordAttemptAndGetTimeline = async ({
  accountSid,
  caseId,
  baseUrl,
  token,
}: {
  accountSid: string;
  caseId: CaseService['id'];
  baseUrl: string;
  token: string;
}) => {
  try {
    // record a new attempt
    const createSectionResult = await createAttemptCaseSection({
      accountSid,
      baseUrl,
      caseId,
      token,
    });
    if (isErr(createSectionResult)) {
      return createSectionResult;
    }

    // get the entire timeline
    const sectionsResult = await getCaseSections({
      accountSid,
      baseUrl,
      caseId,
      sectionType,
      token,
    });
    if (isErr(sectionsResult)) {
      return sectionsResult;
    }

    return newOk({
      data: { sections: sectionsResult.data, currentAttempt: createSectionResult.data },
    });
  } catch (error) {
    return newErr({
      error,
      message: `Unexpected error ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
  }
};

export const updateAttemptCaseSection = async ({
  accountSid,
  caseId,
  beaconIncidentId,
  attemptSection,
  baseUrl,
  token,
}: {
  accountSid: string;
  caseId: CaseService['id'];
  attemptSection: CaseSection;
  beaconIncidentId: PendingIncident['id'];
  baseUrl: string;
  token: string;
}) => {
  try {
    const sectionTypeSpecificData: IncidentReportAttempt = {
      attemptTimestamp: attemptSection.sectionTypeSpecificData.attemptTimestamp,
      createdTimestamp: new Date().toISOString(),
      incidentId: beaconIncidentId,
    };

    const updateSectionResult = await updateCaseSection({
      accountSid,
      caseId,
      sectionId: attemptSection.sectionId,
      sectionType,
      sectionTypeSpecificData,
      baseUrl,
      token,
    });
    if (isErr(updateSectionResult)) {
      return updateSectionResult;
    }

    return newOk({ data: { caseSection: updateSectionResult.data } });
  } catch (error) {
    return newErr({
      error,
      message: `Unexpected error ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
  }
};

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
}) => {
  try {
    // get contact and check for existence of an associated case
    const contactResult = await getContact({ accountSid, contactId, baseUrl, token });
    if (isErr(contactResult)) {
      return contactResult;
    }

    if (contactResult.data.caseId) {
      const caseResult = await getCase({
        accountSid,
        caseId: contactResult.data.caseId,
        baseUrl,
        token,
      });
      if (isErr(caseResult)) {
        return caseResult;
      }

      console.info(`Case exists: ${JSON.stringify(caseResult)}`);

      const sectionsResult = await recordAttemptAndGetTimeline({
        accountSid,
        baseUrl,
        caseId: caseResult.data.id,
        token,
      });
      if (isErr(sectionsResult)) {
        return sectionsResult;
      }

      return newOk({
        data: {
          caseObj: caseResult.data,
          contact: contactResult.data,
          sections: sectionsResult.data,
        },
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
      await deleteCase({ accountSid, baseUrl, caseId: caseObj.id, token });
      return connectedResult;
    }

    // record a new attempt
    const createSectionResult = await createAttemptCaseSection({
      accountSid,
      baseUrl,
      caseId: caseResult.data.id,
      token,
    });
    if (isErr(createSectionResult)) {
      return createSectionResult;
    }

    const sectionsResult = await recordAttemptAndGetTimeline({
      accountSid,
      baseUrl,
      caseId: caseResult.data.id,
      token,
    });
    if (isErr(sectionsResult)) {
      return sectionsResult;
    }

    return newOk({
      data: {
        caseObj: caseResult.data,
        contact: contactResult.data,
        sections: sectionsResult.data,
      },
    });
  } catch (error) {
    return newErr({
      error,
      message: `Unexpected error ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
  }
};

export const wasPendingIncidentCreated = (timeline: TimelineResult) =>
  Boolean(timeline.activities.length) &&
  timeline.activities.some(
    t =>
      (t.activity.sectionTypeSpecificData as IncidentReportAttempt)?.incidentId !== null,
  );

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

import { ItemProcessor, NewCaseSection } from './types';
import {
  ErrorResult,
  isOk,
  newErr,
  newOkFromData,
  SuccessResult,
} from '@tech-matters/types';
import { accountSid } from './config';

const hrmHeaders = {
  Authorization: `Basic ${process.env.STATIC_KEY}`,
  'Content-Type': 'application/json',
};

type CaseNotSpecifiedError = ErrorResult<{
  type: 'CaseNotSpecified';
  sectionId?: string;
  lastUpdated: string;
  level: 'error';
}>;

type InvalidDataError = ErrorResult<{
  type: 'SectionExists' | 'CaseNotFound';
  caseId: string;
  sectionId?: string;
  lastUpdated: string;
  level: 'warn';
}>;

type UnexpectedHttpError = ErrorResult<{
  type: 'UnexpectedHttpError';
  status: number;
  body: string;
  lastUpdated: string;
  level: 'error';
}>;

type UnexpectedError = ErrorResult<{
  type: 'UnexpectedError';
  thrownError: Error;
  level: 'error';
}>;

export const addSectionToAseloCase =
  <TInput>(
    sectionType: string,
    inputToSectionMapper: (item: TInput) => {
      section: NewCaseSection;
      caseId: string;
      lastUpdated: string;
    },
  ): ItemProcessor<TInput> =>
  async (
    inputData: TInput,
    lastSeen: string | null = null,
  ): Promise<
    | InvalidDataError
    | CaseNotSpecifiedError
    | UnexpectedHttpError
    | UnexpectedError
    | SuccessResult<string>
  > => {
    try {
      const { section, caseId, lastUpdated } = inputToSectionMapper(inputData);
      // This works around a bug in the beacon service where it returns later than or equal to the provided updated_after timestamp, not strictly later than.
      if (lastSeen !== null && lastSeen === lastUpdated) {
        console.info(
          `Skipping ${sectionType} ${section.sectionId} (its last updated timestamp ${lastUpdated} is the same as the latest timestamp observed by the poller, indicating it is already processed)`,
        );
        return newOkFromData(lastUpdated);
      }
      const { sectionId } = section;
      console.debug(
        `Start processing ${sectionType}: ${sectionId} (last updated: ${lastUpdated})`,
      );
      if (!caseId) {
        return newErr({
          message: `${sectionType}s not already assigned to a case are not currently supported - rejecting ${sectionType} ${sectionId} (last updated: ${lastUpdated})`,
          error: {
            type: 'CaseNotSpecified',
            sectionId,
            lastUpdated,
            level: 'error',
          },
        });
      }

      const newSectionResponse = await fetch(
        `${process.env.INTERNAL_HRM_URL}/internal/v0/accounts/${accountSid}/cases/${caseId}/sections/${sectionType}`,
        {
          method: 'POST',
          body: JSON.stringify(section),
          headers: hrmHeaders,
        },
      );
      if (newSectionResponse.ok) {
        const newSection: any = await newSectionResponse.json();

        console.info(
          `[${sectionType}] Added new ${sectionType} case section to case ${caseId}`,
        );
        console.debug(
          `[${sectionType}] New ${sectionType} case section to case ${caseId} details:`,
          newSection,
        );
      } else if (newSectionResponse.status === 409) {
        return newErr({
          message: `[${sectionType}] ${sectionId} was already added to case ${caseId} - overwrites are not supported. ${await newSectionResponse.text()}`,
          error: {
            type: 'SectionExists',
            caseId,
            sectionId,
            lastUpdated,
            level: 'warn',
          },
        });
      } else if (newSectionResponse.status === 404) {
        return newErr({
          message: `[${sectionType}] Attempted to add ${sectionType} ${sectionId} to case ${caseId} which does not exist. ${await newSectionResponse.text()}`,
          error: {
            type: 'CaseNotFound',
            caseId,
            sectionId,
            lastUpdated,
            level: 'warn',
          },
        });
      } else {
        return newErr({
          message: `[${sectionType}] Error adding ${sectionType} ${sectionId} to case ${caseId} (status ${newSectionResponse.status})`,
          error: {
            type: 'UnexpectedHttpError',
            status: newSectionResponse.status,
            body: await newSectionResponse.text(),
            lastUpdated,
            level: 'error',
          },
        });
      }
      return newOkFromData(lastUpdated);
    } catch (err) {
      const error = err as Error;
      return newErr({
        message: error.message,
        error: { type: 'UnexpectedError', level: 'error', thrownError: error },
      });
    }
  };

/**
 * Adds a section but ignores all 'last seen' updating / checking.
 * This is for subsections of a main section that always need to be added if the parent is and shouldn't affect the last seen timestamp.
 * @param sectionType
 * @param inputToSectionMapper
 */
export const addDependentSectionToAseloCase =
  <TInput>(
    sectionType: string,
    inputToSectionMapper: (item: TInput) => {
      section: NewCaseSection;
      caseId: string;
    },
  ) =>
  async (item: TInput) => {
    const res = await addSectionToAseloCase(sectionType, (input: TInput) => ({
      ...inputToSectionMapper(input),
      lastUpdated: '',
    }))(item, '_');
    if (isOk(res)) {
      return newOkFromData<void>(undefined);
    } else {
      delete res.error.lastUpdated;
      return res;
    }
  };

export const updateAseloCaseOverview = async (
  caseId: string,
  patch: { operatingArea: string; priority: string },
) => {
  console.info('Updating case overview:', caseId, patch);
  const existingCaseResponse = await fetch(
    `${process.env.INTERNAL_HRM_URL}/internal/v0/accounts/${accountSid}/cases/${caseId}/overview`,
    {
      headers: hrmHeaders,
      method: 'PUT',
      body: JSON.stringify(patch),
    },
  );
  if (!existingCaseResponse.ok) {
    if (existingCaseResponse.status === 404) {
      return newErr({
        message: `[overview] Attempted to patch the overview of case ${caseId}, which does not exist. ${await existingCaseResponse.text()}`,
        error: {
          type: 'CaseNotFound',
          caseId,
          level: 'warn',
        },
      });
    } else {
      return newErr({
        message: `[overview] Error patching the overview of case ${caseId} (status ${existingCaseResponse.status})`,
        error: {
          type: 'UnexpectedHttpError',
          status: existingCaseResponse.status,
          body: await existingCaseResponse.text(),
          level: 'error',
        },
      });
    }
  }
  const updated = await existingCaseResponse.json();
  console.info('Updated case:', updated);
  return newOkFromData(updated);
};

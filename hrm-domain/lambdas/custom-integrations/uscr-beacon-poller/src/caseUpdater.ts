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
  newErr,
  newOkFromData,
  SuccessResult,
} from '@tech-matters/types/dist/Result';
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
  ): Promise<
    | InvalidDataError
    | CaseNotSpecifiedError
    | UnexpectedHttpError
    | UnexpectedError
    | SuccessResult<string>
  > => {
    try {
      const { section, caseId, lastUpdated } = inputToSectionMapper(inputData);
      const { sectionId } = section;
      console.debug(
        `Start processing ${sectionType}: ${sectionId} (last updated: ${lastUpdated})`,
      );
      if (!caseId) {
        console.warn(
          `${sectionType}s not already assigned to a case are not currently supported - rejecting ${sectionType} ${sectionId} (last updated: ${lastUpdated})`,
        );
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
        console.debug(
          `Added new ${sectionType} case section to case ${caseId}:`,
          newSection,
        );
      } else if (newSectionResponse.status === 409) {
        return newErr({
          message: `${sectionType} ${sectionId} was already added to case ${caseId} - overwrites are not supported. ${await newSectionResponse.text()}`,
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
          message: `Attempted to add ${sectionType} ${sectionId} to case ${caseId} which does not exist. ${await newSectionResponse.text()}`,
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
          message: `Error adding ${sectionType} ${sectionId} to case ${caseId} (status ${newSectionResponse.status})`,
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

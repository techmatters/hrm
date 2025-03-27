/* eslint-disable @typescript-eslint/naming-convention */
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

import { ItemProcessor, NewCaseSectionInfo } from './types';
import { addDependentSectionToAseloCase, addSectionToAseloCase } from './caseUpdater';
import { isErr, isOk, newErr } from '@tech-matters/types';
import {
  ProcessedCaseReportApiPayload,
  RawCaseReportApiPayload,
  restructureApiContent,
} from './caseReport/apiPayload';

const checkboxMapToArray = (
  checkboxMap: Record<string, boolean | string | null> | null | undefined,
): string[] =>
  Object.entries(checkboxMap || {})
    .filter(([, checked]) => typeof checked === 'boolean' && checked)
    .map(([key]) => key);

const caseReportToCaseReportCaseSection = ({
  id,
  case_id,
  updated_at,
  'Primary Disposition': primaryDisposition,
  'Secondary Disposition': secondaryDisposition,
  'Issue Report': issueReport,
  'Narrative / Summary ': narrative,
}: ProcessedCaseReportApiPayload): NewCaseSectionInfo => {
  const {
    Behavior: behaviour,
    Intervention: intervention,
    Response: response,
    Plan: plan,
  } = narrative || {};
  const {
    'Tangible Resources Provided': tangibleResourcesProvided,
    'Information Provided': informationProvided,
    'Referral Provided': referralProvided,
    'Services Obtained': serviceObtained,
  } = secondaryDisposition || {};
  return {
    caseId: case_id as string,
    lastUpdated: updated_at,
    section: {
      sectionId: id.toString(),
      sectionTypeSpecificData: {
        primaryDisposition: primaryDisposition?.['Select One'] || null,
        tangibleResourcesProvided: checkboxMapToArray(tangibleResourcesProvided),
        informationProvided: checkboxMapToArray(informationProvided),
        referralProvided: checkboxMapToArray(referralProvided),
        serviceObtained: checkboxMapToArray(serviceObtained),
        issueReport: checkboxMapToArray(issueReport),
        behaviour,
        intervention,
        response,
        plan,
      },
    },
  };
};

const caseReportToPehCaseSection = ({
  id,
  case_id,
  updated_at,
  Demographics: demographics,
}: ProcessedCaseReportApiPayload): NewCaseSectionInfo => {
  const {
    'First Name': firstName,
    'Last Name': lastName,
    Nickname: nickname,
    'Date of Birth': dateOfBirth,
    Gender: genderOptions,
    Language: language,
    'Language Other': languageOther,
  } = demographics || {};
  const { 'Select Gender': gender } = genderOptions || {};
  return {
    caseId: case_id as string,
    lastUpdated: updated_at,
    section: {
      sectionId: id.toString(),
      sectionTypeSpecificData: {
        firstName,
        lastName,
        nickname,
        dateOfBirth,
        gender,
        language: languageOther || language,
      },
    },
  };
};

const caseReportToSafetyPlanCaseSection = ({
  id,
  case_id,
  updated_at,
  'Safety Plan': safetyPlan,
}: ProcessedCaseReportApiPayload): NewCaseSectionInfo => {
  const {
    'Write Signs Here': warningSigns,
    'Write Strategies Here': copingStrategies,
    'Write How Here': safeEnvironment,
    'Write People or Places Here': distractions,

    'Write Contact(s) Here': crisisAgencies,
    'Write Here': whoCanHelp,
  } = safetyPlan || {};
  return {
    caseId: case_id as string,
    lastUpdated: updated_at,
    section: {
      sectionId: id.toString(),
      sectionTypeSpecificData: {
        warningSigns,
        copingStrategies,
        distractions,
        whoCanHelp,
        crisisAgencies,
        safeEnvironment,
      },
    },
  };
};

const caseReportToSudSurveyCaseSection = ({
  id,
  case_id,
  updated_at,
  'Collaborative SUD Survey': collaborativeSudSurvey,
}: ProcessedCaseReportApiPayload): NewCaseSectionInfo => {
  const {
    'In the past 3 months, have you used any of the following substances (check all that apply)':
      substancesUsed,
    'In the past 3 months, have you ever tried and failed to control, cut down, or stop using the substances listed above?':
      failedToControlSubstances,
    'Are you interested in treatment for substance use disorder? If yes, continue with survey.':
      treatmentInterest,
    'There are several options for substance use disorder treatment. Which are you interested in?':
      treatmentPreferences,
    'Do you have a pet(s)/service animal(s)?': hasServiceAnimal,
    'What type of pet(s)/service animal(s)?': petType,
    'Is separating from your pet(s)/service animal a barrier to participating in the pilot program?':
      petSeparationBarrier,
  } = collaborativeSudSurvey || {};
  return {
    caseId: case_id as string,
    lastUpdated: updated_at,
    section: {
      sectionId: id.toString(),
      sectionTypeSpecificData: {
        substancesUsed: checkboxMapToArray(substancesUsed),
        otherSubstancesUsed:
          Object.values(substancesUsed ?? {})
            .filter(v => typeof v === 'string')
            .join(', ') || null,
        failedToControlSubstances,
        treatmentInterest,
        treatmentPreferences,
        hasServiceAnimal,
        petType,
        petSeparationBarrier,
      },
    },
  };
};

const addCaseReportSectionToAseloCase = addSectionToAseloCase(
  'caseReport',
  caseReportToCaseReportCaseSection,
);
const addPehSectionToAseloCase = addDependentSectionToAseloCase(
  'personExperiencingHomelessness',
  caseReportToPehCaseSection,
);
const addSafetyPlanSectionToAseloCase = addDependentSectionToAseloCase(
  'safetyPlan',
  caseReportToSafetyPlanCaseSection,
);
const addSudSurveySectionToAseloCase = addDependentSectionToAseloCase(
  'sudSurvey',
  caseReportToSudSurveyCaseSection,
);

export const addCaseReportSectionsToAseloCase: ItemProcessor<
  RawCaseReportApiPayload
> = async (
  rawCaseReport: RawCaseReportApiPayload,

  lastSeen: string,
) => {
  const caseReport = restructureApiContent(rawCaseReport);
  const caseReportResult = await addCaseReportSectionToAseloCase(caseReport, lastSeen);
  if (isOk(caseReportResult)) {
    const additionalSectionsResults: ReturnType<
      ReturnType<typeof addDependentSectionToAseloCase>
    >[] = [];
    if (caseReport.Demographics) {
      additionalSectionsResults.push(addPehSectionToAseloCase(caseReport));
    }
    if (caseReport['Collaborative SUD Survey']) {
      additionalSectionsResults.push(addSudSurveySectionToAseloCase(caseReport));
    }
    if (caseReport['Safety Plan']) {
      additionalSectionsResults.push(addSafetyPlanSectionToAseloCase(caseReport));
    }
    const errors = (await Promise.all(additionalSectionsResults)).filter(isErr);
    if (errors.length) {
      return newErr({
        message: 'Failed to add additional sections from case report to Aselo case',
        error: {
          type: 'AggregateError',
          level: 'error',
          lastUpdated: caseReportResult.unwrap(),
          errors,
        },
      });
    }
  }
  return caseReportResult;
};

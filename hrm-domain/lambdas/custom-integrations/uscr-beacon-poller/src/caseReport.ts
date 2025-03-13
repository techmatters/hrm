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
import { addSectionToAseloCase } from './caseUpdater';
import { isErr, isOk, newErr } from '@tech-matters/types';

export type CaseReport = {
  id: string;
  case_id: number;
  contact_id: string;
  updated_at: string;
  primary_disposition: string;
  secondary_disposition?: {
    tangible_resources_provided: string[];
    information_provided: string[];
    referral_provided: string[];
    service_obtained: string[];
  };
  issue_report: string[];
  narrative: {
    behaviour: string;
    intervention: string;
    response: string;
    plan: string;
  };
  demographics?: {
    first_name: string;
    last_name: string;
    nickname: string;
    date_of_birth: string;
    gender: string;
    race_ethnicity: string;
    language: string;
  };
  safety_plan?: {
    warning_signs: string;
    coping_strategies: string;
    distractions: string;
    who_can_help: string;
    crisis_agencies: string;
    safe_environment: string;
  };
  collaborative_sud_survey?: {
    substances_used: string[];
    other_substances_used: string;
    failed_to_control_substances: string;
    treatment_interest: string;
    treatment_preferences: string[];
    has_service_animal: string;
    pet_type: string[];
    pet_separation_barrier: string;
  };
};

const caseReportToCaseReportCaseSection = ({
  id,
  case_id,
  updated_at,
  primary_disposition,
  secondary_disposition,
  issue_report,
  narrative: { behaviour, intervention, response, plan },
}: CaseReport): NewCaseSectionInfo => {
  const {
    tangible_resources_provided,
    information_provided,
    referral_provided,
    service_obtained,
  } = secondary_disposition || {};
  return {
    caseId: case_id.toString(),
    lastUpdated: updated_at,
    section: {
      sectionId: id,
      sectionTypeSpecificData: {
        primaryDisposition: primary_disposition,
        tangibleResourcesProvided: tangible_resources_provided,
        informationProvided: information_provided,
        referralProvided: referral_provided,
        serviceObtained: service_obtained,
        issueReport: issue_report,
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
  demographics,
}: CaseReport): NewCaseSectionInfo => {
  const {
    first_name,
    last_name,
    nickname,
    date_of_birth,
    gender,
    language,
    race_ethnicity,
  } = demographics || {};
  return {
    caseId: case_id.toString(),
    lastUpdated: updated_at,
    section: {
      sectionId: id.toString(),
      sectionTypeSpecificData: {
        firstName: first_name,
        lastName: last_name,
        nickname,
        dateOfBirth: date_of_birth,
        gender,
        race: race_ethnicity,
        language,
      },
    },
  };
};

const caseReportToSafetyPlanCaseSection = ({
  id,
  case_id,
  updated_at,
  safety_plan,
}: CaseReport): NewCaseSectionInfo => {
  const {
    warning_signs,
    coping_strategies,
    distractions,
    who_can_help,
    crisis_agencies,
    safe_environment,
  } = safety_plan || {};
  return {
    caseId: case_id.toString(),
    lastUpdated: updated_at,
    section: {
      sectionId: id.toString(),
      sectionTypeSpecificData: {
        warningSigns: warning_signs,
        copingStrategies: coping_strategies,
        distractions,
        whoCanHelp: who_can_help,
        crisisAgencies: crisis_agencies,
        safeEnvironment: safe_environment,
      },
    },
  };
};

const caseReportToSudSurveyCaseSection = ({
  id,
  case_id,
  updated_at,
  collaborative_sud_survey,
}: CaseReport): NewCaseSectionInfo => {
  const {
    substances_used,
    other_substances_used,
    failed_to_control_substances,
    treatment_interest,
    treatment_preferences,
    has_service_animal,
    pet_type,
    pet_separation_barrier,
  } = collaborative_sud_survey || {};
  return {
    caseId: case_id.toString(),
    lastUpdated: updated_at,
    section: {
      sectionId: id.toString(),
      sectionTypeSpecificData: {
        substancesUsed: substances_used,
        otherSubstancesUsed: other_substances_used,
        failedToControlSubstances: failed_to_control_substances,
        treatmentInterest: treatment_interest,
        treatmentPreferences: treatment_preferences,
        hasServiceAnimal: has_service_animal,
        petType: pet_type,
        petSeparationBarrier: pet_separation_barrier,
      },
    },
  };
};

const addCaseReportSectionToAseloCase = addSectionToAseloCase(
  'caseReport',
  caseReportToCaseReportCaseSection,
);
const addPehSectionToAseloCase = addSectionToAseloCase(
  'personExperiencingHomelessness',
  caseReportToPehCaseSection,
);
const addSafetyPlanSectionToAseloCase = addSectionToAseloCase(
  'safetyPlan',
  caseReportToSafetyPlanCaseSection,
);
const addSudSurveySectionToAseloCase = addSectionToAseloCase(
  'sudSurvey',
  caseReportToSudSurveyCaseSection,
);

export const addCaseReportSectionsToAseloCase: ItemProcessor<CaseReport> = async (
  caseReport: CaseReport,
) => {
  const caseReportResult = await addCaseReportSectionToAseloCase(caseReport);
  if (isOk(caseReportResult)) {
    const additionalSectionsResults: ReturnType<
      ReturnType<typeof addSectionToAseloCase>
    >[] = [];
    if (caseReport.demographics) {
      additionalSectionsResults.push(addPehSectionToAseloCase(caseReport));
    }
    if (caseReport.collaborative_sud_survey) {
      additionalSectionsResults.push(addSudSurveySectionToAseloCase(caseReport));
    }
    if (caseReport.safety_plan) {
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

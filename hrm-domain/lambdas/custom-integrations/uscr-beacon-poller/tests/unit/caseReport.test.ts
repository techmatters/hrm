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

import { NewCaseSection } from '../../src/types';
import { generateCaseReport, generateCompleteCaseReport } from '../mockGenerators';
import { addCaseReportSectionsToAseloCase, CaseReport } from '../../src/caseReport';
import '@tech-matters/testing';
import { isErr, isOk } from '@tech-matters/types';
import { AssertionError } from 'node:assert';

const mockFetch: jest.MockedFunction<typeof fetch> = jest.fn();

global.fetch = mockFetch;

describe('addCaseReportSectionsToAseloCase', () => {
  const verifyAddSectionRequest = (
    caseId: string,
    caseSectionType:
      | 'caseReport'
      | 'personExperiencingHomelessness'
      | 'sudSurvey'
      | 'safetyPlan',
    expectedCaseSection: NewCaseSection,
    firstRequest = true,
  ) => {
    expect(mockFetch.mock.calls.length).toBeGreaterThan(firstRequest ? 0 : 1);
    const [firstCall, ...subsequentCalls] = mockFetch.mock.calls;
    const callsToCheck = firstRequest ? [firstCall] : subsequentCalls;
    const call = callsToCheck.find(
      ([url]) =>
        url ===
        `${process.env.INTERNAL_HRM_URL}/internal/v0/accounts/${process.env.ACCOUNT_SID}/cases/${caseId}/sections/${caseSectionType}`,
    );
    if (!call) {
      throw new AssertionError({
        message: `Expected request to ${caseSectionType} section not found`,
        actual: mockFetch.mock.calls,
      });
    }

    expect(call[1]).toStrictEqual({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${process.env.STATIC_KEY}`,
      },
      body: expect.any(String),
    });
    let parsedJson = JSON.parse(call[1]!.body as string);
    expect(parsedJson).toStrictEqual(expectedCaseSection);
  };

  const caseReportWithCoreSection = generateCaseReport({
    id: 'caseReportId',
    case_id: 5678,
    issue_report: ['issue1', 'issue2'],
    updated_at: 'Christmas time',
    primary_disposition: '1234',
    secondary_disposition: {
      tangible_resources_provided: ['tangerine'],
      referral_provided: ['referral'],
      service_obtained: ['service', 'obtained'],
      information_provided: ['some', 'information'],
    },
    narrative: {
      behaviour: 'Ill',
      plan: 'Nine',
      intervention: 'Great',
      response: 'Music',
    },
  });

  const completeCaseReport = generateCompleteCaseReport({ id: 'caseReportId' });

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);
  });

  test('Case report with only core case report sections - only adds a case report section', async () => {
    // Act
    const res = await addCaseReportSectionsToAseloCase(caseReportWithCoreSection);

    // Assert
    verifyAddSectionRequest('5678', 'caseReport', {
      sectionId: 'caseReportId',
      sectionTypeSpecificData: {
        issueReport: ['issue1', 'issue2'],
        primaryDisposition: '1234',
        tangibleResourcesProvided: ['tangerine'],
        referralProvided: ['referral'],
        serviceObtained: ['service', 'obtained'],
        informationProvided: ['some', 'information'],

        behaviour: 'Ill',
        plan: 'Nine',
        intervention: 'Great',
        response: 'Music',
      },
    });
    expect(mockFetch).not.toHaveBeenCalledWith(
      `${process.env.INTERNAL_HRM_URL}/internal/v0/accounts/${process.env.ACCOUNT_SID}/cases/5678/sections/personExperiencingHomelessness`,
      expect.anything(),
    );
    expect(mockFetch).not.toHaveBeenCalledWith(
      `${process.env.INTERNAL_HRM_URL}/internal/v0/accounts/${process.env.ACCOUNT_SID}/cases/5678/sections/safetyPlan`,
      expect.anything(),
    );
    expect(mockFetch).not.toHaveBeenCalledWith(
      `${process.env.INTERNAL_HRM_URL}/internal/v0/accounts/${process.env.ACCOUNT_SID}/cases/5678/sections/sudSurvey`,
      expect.anything(),
    );
    if (isOk(res)) {
      expect(res.unwrap()).toEqual('Christmas time');
    } else {
      throw new AssertionError({ message: 'Expected success result', actual: res });
    }
  });
  test('Case report with demographics additional case report property - adds a case report and a PEH section', async () => {
    // Arrange
    const caseReport: CaseReport = {
      ...caseReportWithCoreSection,
      demographics: {
        first_name: 'Charlotte',
        last_name: 'Ballantyne',
        nickname: 'Charlie',
        date_of_birth: '10-1-1990',
        gender: 'female',
        race_ethnicity: 'white',
        language: 'English',
      },
    };

    // Act
    const res = await addCaseReportSectionsToAseloCase(caseReport);

    // Assert
    verifyAddSectionRequest('5678', 'caseReport', {
      sectionId: 'caseReportId',
      sectionTypeSpecificData: expect.anything(),
    });

    verifyAddSectionRequest(
      '5678',
      'personExperiencingHomelessness',
      {
        sectionId: 'caseReportId',
        sectionTypeSpecificData: {
          firstName: 'Charlotte',
          lastName: 'Ballantyne',
          nickname: 'Charlie',
          dateOfBirth: '10-1-1990',
          gender: 'female',
          race: 'white',
          language: 'English',
        },
      },
      false,
    );
    expect(mockFetch).not.toHaveBeenCalledWith(
      `${process.env.INTERNAL_HRM_URL}/internal/v0/accounts/${process.env.ACCOUNT_SID}/cases/5678/sections/safetyPlan`,
      expect.anything(),
    );
    expect(mockFetch).not.toHaveBeenCalledWith(
      `${process.env.INTERNAL_HRM_URL}/internal/v0/accounts/${process.env.ACCOUNT_SID}/cases/5678/sections/sudSurvey`,
      expect.anything(),
    );
    if (isOk(res)) {
      expect(res.unwrap()).toEqual('Christmas time');
    } else {
      throw new AssertionError({ message: 'Expected success result', actual: res });
    }
  });
  test('Case report with safety_plan additional case report property - adds a case report and a safety plan section', async () => {
    // Arrange
    const caseReport: CaseReport = {
      ...caseReportWithCoreSection,
      safety_plan: {
        warning_signs: 'warning',
        coping_strategies: 'coping',
        distractions: 'distractions',
        who_can_help: 'who',
        crisis_agencies: 'crisis',
        safe_environment: 'safe',
      },
    };

    // Act
    const res = await addCaseReportSectionsToAseloCase(caseReport);

    // Assert
    verifyAddSectionRequest('5678', 'caseReport', {
      sectionId: 'caseReportId',
      sectionTypeSpecificData: expect.anything(),
    });
    expect(mockFetch).not.toHaveBeenCalledWith(
      `${process.env.INTERNAL_HRM_URL}/internal/v0/accounts/${process.env.ACCOUNT_SID}/cases/5678/sections/personExperiencingHomelessness`,
      expect.anything(),
    );

    verifyAddSectionRequest(
      '5678',
      'safetyPlan',
      {
        sectionId: 'caseReportId',
        sectionTypeSpecificData: {
          warningSigns: 'warning',
          copingStrategies: 'coping',
          distractions: 'distractions',
          whoCanHelp: 'who',
          crisisAgencies: 'crisis',
          safeEnvironment: 'safe',
        },
      },
      false,
    );
    expect(mockFetch).not.toHaveBeenCalledWith(
      `${process.env.INTERNAL_HRM_URL}/internal/v0/accounts/${process.env.ACCOUNT_SID}/cases/5678/sections/sudSurvey`,
      expect.anything(),
    );
    if (isOk(res)) {
      expect(res.unwrap()).toEqual('Christmas time');
    } else {
      throw new AssertionError({ message: 'Expected success result', actual: res });
    }
  });
  test('Case report with collaborative_sud_survey additional case report property - adds a case report and a sud survey section', async () => {
    // Arrange
    const caseReport: CaseReport = {
      ...caseReportWithCoreSection,
      collaborative_sud_survey: {
        substances_used: ['thing1', 'thing2'],
        other_substances_used: 'other',
        failed_to_control_substances: 'thing1',
        treatment_interest: 'much',
        treatment_preferences: ['many', 'treatments'],
        has_service_animal: 'yes',
        pet_type: ['quasit'],
        pet_separation_barrier: 'cannot get rid of it, it follows me everywhere',
      },
    };

    // Act
    const res = await addCaseReportSectionsToAseloCase(caseReport);

    // Assert
    verifyAddSectionRequest('5678', 'caseReport', {
      sectionId: 'caseReportId',
      sectionTypeSpecificData: expect.anything(),
    });
    expect(mockFetch).not.toHaveBeenCalledWith(
      `${process.env.INTERNAL_HRM_URL}/internal/v0/accounts/${process.env.ACCOUNT_SID}/cases/5678/sections/personExperiencingHomelessness`,
      expect.anything(),
    );
    expect(mockFetch).not.toHaveBeenCalledWith(
      `${process.env.INTERNAL_HRM_URL}/internal/v0/accounts/${process.env.ACCOUNT_SID}/cases/5678/sections/safetyPlan`,
      expect.anything(),
    );

    verifyAddSectionRequest(
      '5678',
      'sudSurvey',
      {
        sectionId: 'caseReportId',
        sectionTypeSpecificData: {
          substancesUsed: ['thing1', 'thing2'],
          otherSubstancesUsed: 'other',
          failedToControlSubstances: 'thing1',
          treatmentInterest: 'much',
          treatmentPreferences: ['many', 'treatments'],
          hasServiceAnimal: 'yes',
          petType: ['quasit'],
          petSeparationBarrier: 'cannot get rid of it, it follows me everywhere',
        },
      },
      false,
    );
    if (isOk(res)) {
      expect(res.unwrap()).toEqual('Christmas time');
    } else {
      throw new AssertionError({ message: 'Expected success result', actual: res });
    }
  });

  test('Case report with all additional case report data - adds a case report and all additional sections', async () => {
    // Act
    const res = await addCaseReportSectionsToAseloCase(completeCaseReport);

    // Assert
    verifyAddSectionRequest('5678', 'caseReport', {
      sectionId: 'caseReportId',
      sectionTypeSpecificData: expect.anything(),
    });

    verifyAddSectionRequest(
      '5678',
      'personExperiencingHomelessness',
      {
        sectionId: 'caseReportId',
        sectionTypeSpecificData: expect.anything(),
      },
      false,
    );
    verifyAddSectionRequest(
      '5678',
      'safetyPlan',
      {
        sectionId: 'caseReportId',
        sectionTypeSpecificData: expect.anything(),
      },
      false,
    );

    verifyAddSectionRequest(
      '5678',
      'sudSurvey',
      {
        sectionId: 'caseReportId',
        sectionTypeSpecificData: expect.anything(),
      },
      false,
    );
    if (isOk(res)) {
      expect(res.unwrap()).toEqual('Christmas time');
    } else {
      throw new AssertionError({ message: 'Expected success result', actual: res });
    }
  });
  test("Adding case report section fails - doesn't try to add additional ones", async () => {
    // Arrange
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: false,
      status: 409,
      text: async () => 'splat',
    } as Response);

    // Act
    const res = await addCaseReportSectionsToAseloCase(caseReportWithCoreSection);

    // Assert
    verifyAddSectionRequest('5678', 'caseReport', {
      sectionId: 'caseReportId',
      sectionTypeSpecificData: expect.anything(),
    });
    expect(mockFetch).not.toHaveBeenCalledWith(
      `${process.env.INTERNAL_HRM_URL}/internal/v0/accounts/${process.env.ACCOUNT_SID}/cases/5678/sections/personExperiencingHomelessness`,
      expect.anything(),
    );
    expect(mockFetch).not.toHaveBeenCalledWith(
      `${process.env.INTERNAL_HRM_URL}/internal/v0/accounts/${process.env.ACCOUNT_SID}/cases/5678/sections/safetyPlan`,
      expect.anything(),
    );
    expect(mockFetch).not.toHaveBeenCalledWith(
      `${process.env.INTERNAL_HRM_URL}/internal/v0/accounts/${process.env.ACCOUNT_SID}/cases/5678/sections/sudSurvey`,
      expect.anything(),
    );
    if (isErr(res)) {
      expect(res.error.lastUpdated).toEqual('Christmas time');
    } else {
      throw new AssertionError({ message: 'Expected error result', actual: res });
    }
  });

  test('Additional section fails - still adds other sections, reports all errors in  response', async () => {
    // Arrange
    jest.clearAllMocks();
    mockFetch.mockImplementation(async url => {
      if (url.toString().endsWith('personExperiencingHomelessness')) {
        return {
          ok: false,
          status: 409,
          text: async () => 'splat',
        } as Response;
      }
      if (url.toString().endsWith('safetyPlan')) {
        return {
          ok: false,
          status: 500,
          text: async () => 'splat',
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({}),
      } as Response;
    });
    // Act
    const res = await addCaseReportSectionsToAseloCase(completeCaseReport);

    // Assert
    verifyAddSectionRequest('5678', 'caseReport', {
      sectionId: 'caseReportId',
      sectionTypeSpecificData: expect.anything(),
    });

    verifyAddSectionRequest(
      '5678',
      'personExperiencingHomelessness',
      {
        sectionId: 'caseReportId',
        sectionTypeSpecificData: expect.anything(),
      },
      false,
    );
    verifyAddSectionRequest(
      '5678',
      'safetyPlan',
      {
        sectionId: 'caseReportId',
        sectionTypeSpecificData: expect.anything(),
      },
      false,
    );

    verifyAddSectionRequest(
      '5678',
      'sudSurvey',
      {
        sectionId: 'caseReportId',
        sectionTypeSpecificData: expect.anything(),
      },
      false,
    );
    if (isErr(res)) {
      expect(res.error.lastUpdated).toEqual('Christmas time');
      const error = res.error as any;
      expect(error.type).toBe('AggregateError');
      expect(error.errors).toHaveLength(2);
      expect(error.errors[0].error.type).toBe('SectionExists');
      expect(error.errors[0].error.caseId).toBe('5678');
      expect(error.errors[0].error.sectionId).toBe('caseReportId');
      expect(error.errors[1].error.type).toBe('UnexpectedHttpError');
      expect(error.errors[1].error.status).toBe(500);
      expect(error.errors[1].error.body).toBe('splat');
    } else {
      throw new AssertionError({ message: 'Expected error result', actual: res });
    }
  });
});

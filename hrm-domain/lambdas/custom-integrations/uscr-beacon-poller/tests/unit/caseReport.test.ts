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

import {
  generateCaseReport,
  generateCaseReportCheckboxValueNode,
  generateCaseReportSectionNode,
  generateCaseReportTextValueNode,
  generateCompleteCaseReport,
} from '../mockGenerators';
import { addCaseReportSectionsToAseloCase } from '../../src/caseReport';
import '@tech-matters/testing';
import { isErr, isOk } from '@tech-matters/types';
import { AssertionError } from 'node:assert';
import { verifyAddSectionRequest } from './verifyAddSectionRequest';
import { RawCaseReportApiPayload } from '../../src/caseReport/apiPayload';

const mockFetch: jest.MockedFunction<typeof fetch> = jest.fn();

global.fetch = mockFetch;

describe('addCaseReportSectionsToAseloCase', () => {
  const caseReportWithCoreSection = generateCaseReport({
    id: 1234,
    case_id: '5678',
    issue_report: ['issue1', 'issue2'],
    updated_at: 'Christmas time',
    content: {
      fields: [
        generateCaseReportSectionNode('Primary Disposition', [
          generateCaseReportTextValueNode('Select One', '1234'),
        ]),
        generateCaseReportSectionNode('Secondary Disposition', [
          generateCaseReportSectionNode('Tangible Resources Provided', [
            generateCaseReportCheckboxValueNode('tangerine', true),
            generateCaseReportCheckboxValueNode('orange', false),
          ]),
          generateCaseReportSectionNode('Referral Provided', [
            generateCaseReportCheckboxValueNode('referral', true),
          ]),
          generateCaseReportSectionNode('Services Obtained', [
            generateCaseReportCheckboxValueNode('service', true),
            generateCaseReportCheckboxValueNode('obtained', true),
          ]),
          generateCaseReportSectionNode('Information Provided', [
            generateCaseReportCheckboxValueNode('some', true),
            generateCaseReportCheckboxValueNode('information', true),
          ]),
        ]),
        generateCaseReportSectionNode('Narrative / Summary ', [
          generateCaseReportTextValueNode('Behavior', 'Ill'),
          generateCaseReportTextValueNode('Intervention', 'Great'),
          generateCaseReportTextValueNode('Response', 'Music'),
          generateCaseReportTextValueNode('Plan', 'Nine'),
        ]),
        generateCaseReportSectionNode('Issue Report', [
          generateCaseReportCheckboxValueNode('issue0', false),
          generateCaseReportCheckboxValueNode('issue1', true),
          generateCaseReportCheckboxValueNode('issue2', true),
        ]),
      ],
    },
  });

  const completeCaseReport = generateCompleteCaseReport({ id: 1234 });

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);
  });

  test('Case report with only core case report sections - only adds a case report section', async () => {
    // Act
    const res = await addCaseReportSectionsToAseloCase(
      caseReportWithCoreSection,
      'something',
    );

    // Assert
    verifyAddSectionRequest('5678', 'caseReport', {
      sectionId: '1234',
      sectionTypeSpecificData: {
        issueReport: ['issue1', 'issue2'],
        primaryDisposition: '1234',
        tangibleResourcesProvided: ['tangerine'],
        referralProvided: ['referral'],
        serviceObtained: ['service', 'obtained'],
        informationProvided: ['some', 'information'],

        behavior: 'Ill',
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
    const caseReport: RawCaseReportApiPayload = {
      ...caseReportWithCoreSection,
      content: {
        fields: [
          ...caseReportWithCoreSection.content.fields,
          generateCaseReportSectionNode('Demographics', [
            generateCaseReportTextValueNode('First Name', 'Charlotte'),
            generateCaseReportTextValueNode('Last Name', 'Ballantyne'),
            generateCaseReportTextValueNode('Nickname', 'Charlie'),
            generateCaseReportTextValueNode('Date of Birth', '10-1-1990'),
            generateCaseReportSectionNode('Gender', [
              generateCaseReportTextValueNode('Select Gender', 'female'),
            ]),
            generateCaseReportTextValueNode('Race/Ethnicity', 'white'),
            generateCaseReportTextValueNode('Language', 'English'),
          ]),
        ],
      },
    };

    // Act
    const res = await addCaseReportSectionsToAseloCase(caseReport, 'something');

    // Assert
    verifyAddSectionRequest('5678', 'caseReport', {
      sectionId: '1234',
      sectionTypeSpecificData: expect.anything(),
    });

    verifyAddSectionRequest(
      '5678',
      'personExperiencingHomelessness',
      {
        sectionId: '1234',
        sectionTypeSpecificData: {
          firstName: 'Charlotte',
          lastName: 'Ballantyne',
          nickname: 'Charlie',
          dateOfBirth: '10-1-1990',
          gender: 'female',
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
    const caseReport: RawCaseReportApiPayload = {
      ...caseReportWithCoreSection,
      content: {
        fields: [
          ...caseReportWithCoreSection.content.fields,
          generateCaseReportSectionNode('Safety Plan', [
            generateCaseReportTextValueNode('Write Signs Here', 'warning'),
            generateCaseReportTextValueNode('Write Strategies Here', 'coping'),
            generateCaseReportTextValueNode(
              'Write People or Places Here',
              'distractions',
            ),
            generateCaseReportTextValueNode('Write Here', 'who'),
            generateCaseReportTextValueNode('Write Contact(s) Here', 'crisis'),
            generateCaseReportTextValueNode('Write How Here', 'safe'),
          ]),
        ],
      },
    };

    // Act
    const res = await addCaseReportSectionsToAseloCase(caseReport, 'something');

    // Assert
    verifyAddSectionRequest('5678', 'caseReport', {
      sectionId: '1234',
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
        sectionId: '1234',
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
    const caseReport: RawCaseReportApiPayload = {
      ...caseReportWithCoreSection,
      content: {
        fields: [
          ...caseReportWithCoreSection.content.fields,
          generateCaseReportSectionNode('Collaborative SUD Survey', [
            generateCaseReportSectionNode(
              'In the past 3 months, have you used any of the following substances (check all that apply)',
              [
                generateCaseReportCheckboxValueNode('thing1', true),
                generateCaseReportCheckboxValueNode('thing2', true),
                generateCaseReportTextValueNode('Other Substances Used', 'other'),
              ],
            ),
            generateCaseReportTextValueNode(
              'In the past 3 months, have you ever tried and failed to control, cut down, or stop using the substances listed above?',
              'thing1',
            ),
            generateCaseReportTextValueNode(
              'Are you interested in treatment for substance use disorder? If yes, continue with survey.',
              'much',
            ),
            generateCaseReportTextValueNode(
              'There are several options for substance use disorder treatment. Which are you interested in?',
              'many treatments',
            ),
            generateCaseReportTextValueNode(
              'Do you have a pet(s)/service animal(s)?',
              'yes',
            ),
            generateCaseReportTextValueNode(
              'What type of pet(s)/service animal(s)?',
              'quasit',
            ),
            generateCaseReportTextValueNode(
              'Is separating from your pet(s)/service animal a barrier to participating in the pilot program?',
              'cannot get rid of it, it follows me everywhere',
            ),
          ]),
        ],
      },
    };

    // Act
    const res = await addCaseReportSectionsToAseloCase(caseReport, 'something');

    // Assert
    verifyAddSectionRequest('5678', 'caseReport', {
      sectionId: '1234',
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
        sectionId: '1234',
        sectionTypeSpecificData: {
          substancesUsed: ['thing1', 'thing2'],
          otherSubstancesUsed: 'other',
          failedToControlSubstances: 'thing1',
          treatmentInterest: 'much',
          treatmentPreferences: 'many treatments',
          hasServiceAnimal: 'yes',
          petType: 'quasit',
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
    const res = await addCaseReportSectionsToAseloCase(completeCaseReport, 'something');

    // Assert
    verifyAddSectionRequest('5678', 'caseReport', {
      sectionId: '1234',
      sectionTypeSpecificData: expect.anything(),
    });

    verifyAddSectionRequest(
      '5678',
      'personExperiencingHomelessness',
      {
        sectionId: '1234',
        sectionTypeSpecificData: expect.anything(),
      },
      false,
    );
    verifyAddSectionRequest(
      '5678',
      'safetyPlan',
      {
        sectionId: '1234',
        sectionTypeSpecificData: expect.anything(),
      },
      false,
    );

    verifyAddSectionRequest(
      '5678',
      'sudSurvey',
      {
        sectionId: '1234',
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
    const res = await addCaseReportSectionsToAseloCase(
      caseReportWithCoreSection,
      'something',
    );

    // Assert
    verifyAddSectionRequest('5678', 'caseReport', {
      sectionId: '1234',
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
    const res = await addCaseReportSectionsToAseloCase(completeCaseReport, 'something');

    // Assert
    verifyAddSectionRequest('5678', 'caseReport', {
      sectionId: '1234',
      sectionTypeSpecificData: expect.anything(),
    });

    verifyAddSectionRequest(
      '5678',
      'personExperiencingHomelessness',
      {
        sectionId: '1234',
        sectionTypeSpecificData: expect.anything(),
      },
      false,
    );
    verifyAddSectionRequest(
      '5678',
      'safetyPlan',
      {
        sectionId: '1234',
        sectionTypeSpecificData: expect.anything(),
      },
      false,
    );

    verifyAddSectionRequest(
      '5678',
      'sudSurvey',
      {
        sectionId: '1234',
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
      expect(error.errors[0].error.sectionId).toBe('1234');
      expect(error.errors[1].error.type).toBe('UnexpectedHttpError');
      expect(error.errors[1].error.status).toBe(500);
      expect(error.errors[1].error.body).toBe('splat');
    } else {
      throw new AssertionError({ message: 'Expected error result', actual: res });
    }
  });
});

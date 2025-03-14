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
import { generateCaseReport } from '../mockGenerators';
import { addCaseReportSectionsToAseloCase, CaseReport } from '../../src/caseReport';
import '@tech-matters/testing';
import { isOk } from '@tech-matters/types';
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
    requestIndex = 0,
  ) => {
    expect(mockFetch.mock.calls.length).toBeGreaterThan(requestIndex);
    const [url, options] = mockFetch.mock.calls[requestIndex];
    expect(url).toEqual(
      `${process.env.INTERNAL_HRM_URL}/internal/v0/accounts/${process.env.ACCOUNT_SID}/cases/${caseId}/sections/${caseSectionType}`,
    );
    expect(options).toStrictEqual({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${process.env.STATIC_KEY}`,
      },
      body: expect.any(String),
    });
    let parsedJson = JSON.parse(options!.body as string);
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
  test('Case report with PEH additional case report section - adds a case report and a PEH section', async () => {
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
      1,
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
});

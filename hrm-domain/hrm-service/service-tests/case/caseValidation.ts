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
  CaseService,
  WELL_KNOWN_CASE_SECTION_NAMES,
} from '@tech-matters/hrm-core/case/caseService';
import { NewContactRecord } from '@tech-matters/hrm-core/contact/sql/contactInsertSql';
import { ContactRawJson } from '@tech-matters/hrm-core/contact/contactJson';
import { Contact } from '@tech-matters/hrm-core/contact/contactDataAccess';
// eslint-disable-next-line import/no-extraneous-dependencies
import '@tech-matters/testing/expectToParseAsDate';

export const without = (original, ...property) => {
  if (!original) return original;
  const { ...output } = original;
  property.forEach(p => delete output[p]);
  return output;
};

export const convertCaseInfoToExpectedInfo = (
  input: Partial<CaseService>,
  accountSid: string | null = null,
): CaseService => {
  if (!input || !input.info) return { ...input } as CaseService;
  const expectedCase: Partial<CaseService> = {
    sections: {},
    ...input,
    info: { ...input.info },
  };
  const { info: expectedInfo } = expectedCase;
  if (expectedInfo) {
    Object.keys(WELL_KNOWN_CASE_SECTION_NAMES).forEach(sectionName => {
      if (expectedInfo[sectionName] && expectedInfo[sectionName].length) {
        expectedInfo[sectionName] = expectedInfo[sectionName].map(section => ({
          id: expect.anything(),
          ...section,
          accountSid: section.accountSid || expectedCase.accountSid || accountSid,
          createdAt: expect.toParseAsDate(section.createdAt),
        }));
      } else {
        delete expectedInfo[sectionName];
        if (sectionName === 'counsellorNotes') {
          delete expectedInfo.notes;
        }
      }
    });
  }
  return expectedCase as CaseService;
};

export const validateCaseListResponse = (
  actual,
  expectedCaseAndContactModels: { case: CaseService; contact: Contact }[],
  count,
) => {
  expect(actual.status).toBe(200);
  if (count === 0) {
    expect(actual.body).toStrictEqual(
      expect.objectContaining({
        cases: [],
        count,
      }),
    );
    return;
  }
  expect(actual.body).toStrictEqual(
    expect.objectContaining({
      cases: expect.arrayContaining([expect.anything()]),
      count,
    }),
  );
  expectedCaseAndContactModels.forEach(
    ({ case: expectedCaseModel, contact: expectedContactModel }, index) => {
      const { connectedContacts, ...caseDataValues } = expectedCaseModel;
      expect(actual.body.cases[index]).toMatchObject({
        ...caseDataValues,
        createdAt: expectedCaseModel.createdAt,
        updatedAt: expectedCaseModel.updatedAt,
      });

      expect(actual.body.cases[index].connectedContacts).toStrictEqual([
        expect.objectContaining({
          ...expectedContactModel,
          csamReports: [],
          referrals: [],
          timeOfContact: expect.toParseAsDate(expectedContactModel.timeOfContact),
          createdAt: expect.toParseAsDate(expectedContactModel.createdAt),
          finalizedAt: expect.toParseAsDate(expectedContactModel.finalizedAt),
          updatedAt: expect.toParseAsDate(expectedContactModel.updatedAt),
        }),
      ]);
    },
  );
};

export const validateSingleCaseResponse = (
  actual,
  expectedCaseModel,
  expectedContactModel,
) => {
  validateCaseListResponse(
    actual,
    [{ case: expectedCaseModel, contact: expectedContactModel }],
    1,
  );
};

export const fillNameAndPhone = (
  contact: NewContactRecord,
  name = {
    firstName: 'Maria',
    lastName: 'Silva',
  },
  number = '+1-202-555-0184',
): NewContactRecord => {
  const modifiedContact: NewContactRecord = {
    ...contact,
    rawJson: {
      ...(contact.rawJson as ContactRawJson),
      childInformation: {
        ...contact.rawJson.childInformation,
        ...name,
      },
    },
    number,
  };

  delete (<any>modifiedContact).form;

  return modifiedContact;
};

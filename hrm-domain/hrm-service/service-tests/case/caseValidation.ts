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

import { CaseService } from '@tech-matters/hrm-core/case/caseService';
import { NewContactRecord } from '@tech-matters/hrm-core/contact/sql/contactInsertSql';
import { ContactRawJson } from '@tech-matters/hrm-core/contact/contactJson';
// eslint-disable-next-line import/no-extraneous-dependencies
import '@tech-matters/testing/expectToParseAsDate';

export const validateCaseListResponse = (actual, expectedCases: CaseService[], count) => {
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
  expectedCases.forEach((expectedCaseModel, index) => {
    const { ...caseDataValues } = expectedCaseModel;
    expect(actual.body.cases[index]).toMatchObject({
      ...caseDataValues,
      createdAt: expectedCaseModel.createdAt,
      updatedAt: expectedCaseModel.updatedAt,
    });
  });
};

export const validateSingleCaseResponse = (actual, expectedCaseModel: CaseService) => {
  validateCaseListResponse(actual, [expectedCaseModel], 1);
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

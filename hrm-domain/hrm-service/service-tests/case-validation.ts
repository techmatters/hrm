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

import { WELL_KNOWN_CASE_SECTION_NAMES } from '../src/case/case';
import { NewContactRecord } from '../src/contact/sql/contact-insert-sql';
import {
  ContactRawJson,
  CreateContactPayload,
  WithLegacyCategories,
} from '../src/contact/contact';
import { Contact } from '../src/contact/contact-data-access';

declare global {
  namespace jest {
    interface Matchers<R> {
      toParseAsDate(date: Date): R;
    }
    // @ts-ignore
    interface Expect<R> {
      toParseAsDate(date: Date): R;
    }
  }
}

expect.extend({
  toParseAsDate(received, date) {
    let receivedDate;
    try {
      receivedDate = received instanceof Date ? received : Date.parse(received);
    } catch (e) {
      return {
        pass: false,
        message: () => `Expected '${received}' to be a parseable date. Error: ${e}`,
      };
    }

    if (date) {
      const expectedDate = typeof date === 'string' ? Date.parse(date) : date;
      const pass = receivedDate.valueOf() === expectedDate.valueOf();
      return {
        pass,
        message: () =>
          `Expected '${received}' to be the same as '${expectedDate.toISOString()}'`,
      };
    }

    return {
      pass: true,
      message: () => `Expected '${received}' to be a parseable date.`,
    };
  },
});

export const without = (original, ...property) => {
  if (!original) return original;
  const { ...output } = original;
  property.forEach(p => delete output[p]);
  return output;
};

export const convertCaseInfoToExpectedInfo = (
  input: any,
  accountSid: string | null = null,
) => {
  if (!input || !input.info) return { ...input };
  const expectedCase = {
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
  return expectedCase;
};

export const addLegacyCategoriesToContact = (
  contact: Contact,
): WithLegacyCategories<Contact> => {
  if (contact?.rawJson) {
    const legacyCategoryEntries = Object.entries(contact.rawJson.categories ?? {}).map(
      ([category, subcategoryList]) => [
        category,
        Object.fromEntries(subcategoryList.map(sc => [sc, true])),
      ],
    );
    return {
      ...contact,
      rawJson: {
        ...contact.rawJson,
        caseInformation: {
          ...contact.rawJson.caseInformation,
          categories: Object.fromEntries(legacyCategoryEntries),
        },
      },
    };
  }
  return contact as WithLegacyCategories<Contact>;
};

export const validateCaseListResponse = (actual, expectedCaseAndContactModels, count) => {
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
        createdAt: expectedCaseModel.createdAt.toISOString(),
        updatedAt: expectedCaseModel.updatedAt.toISOString(),
      });

      expect(actual.body.cases[index].connectedContacts).toStrictEqual([
        expect.objectContaining({
          ...addLegacyCategoriesToContact(expectedContactModel),
          csamReports: [],
          referrals: [],
          timeOfContact: expect.toParseAsDate(expectedContactModel.timeOfContact),
          createdAt: expect.toParseAsDate(expectedContactModel.createdAt),
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
  contact: CreateContactPayload,
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

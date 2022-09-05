import { WELL_KNOWN_CASE_SECTION_NAMES } from '../src/case/case';
import { NewContactRecord } from '../src/contact/sql/contact-insert-sql';
import { ContactRawJson } from '../src/contact/contact-json';
import { CreateContactPayload, CreateContactPayloadWithFormProperty } from '../src/contact/contact';

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
        message: () => `Expected '${received}' to be the same as '${expectedDate.toISOString()}'`,
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

export const convertCaseInfoToExpectedInfo = (input: any, accountSid: string | null = null) => {
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
          ...expectedContactModel,
          csamReports: [],
          timeOfContact: expect.toParseAsDate(expectedContactModel.timeOfContact),
          createdAt: expect.toParseAsDate(expectedContactModel.createdAt),
          updatedAt: expect.toParseAsDate(expectedContactModel.updatedAt),
          rawJson: {
            ...expectedContactModel.rawJson,
          },
        }),
      ]);
    },
  );
};

export const validateSingleCaseResponse = (actual, expectedCaseModel, expectedContactModel) => {
  validateCaseListResponse(actual, [{ case: expectedCaseModel, contact: expectedContactModel }], 1);
};

export const fillNameAndPhone = (
  contact: CreateContactPayloadWithFormProperty,
  name = {
    firstName: 'Maria',
    lastName: 'Silva',
  },
  number = '+1-202-555-0184',
): NewContactRecord => {
  const modifiedContact: NewContactRecord = {
    ...contact,
    rawJson: {
      ...contact.form,
      childInformation: {
        ...contact.form.childInformation,
        name,
      },
    },
    number,
  };

  delete (<any>modifiedContact).form;

  return modifiedContact;
};

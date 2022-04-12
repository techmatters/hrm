import { db, pgp } from '../src/connection-pool';
import { WELL_KNOWN_CASE_SECTION_NAMES } from '../src/case/case';

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

export const caseAuditsWhereClause = (workerSid: string) =>
  pgp.as.format(`WHERE "twilioWorkerId" IN($<workers:csv>) `, {
    workers: ['fake-worker-123', 'fake-worker-129', workerSid],
  });
export const countCaseAudits = async (workerSid: string): Promise<number> => {
  return (
    await db.one<{ count: number }>(
      `SELECT COUNT(*)::integer AS count FROM "CaseAudits" $<whereClause:raw>`,
      {
        whereClause: caseAuditsWhereClause(workerSid),
      },
    )
  ).count;
};
export const selectCaseAudits = async (workerSid: string): Promise<any[]> =>
  db.manyOrNone(`SELECT * FROM "CaseAudits" $<whereClause:raw>`, {
    whereClause: caseAuditsWhereClause(workerSid),
  });
export const deleteCaseAudits = async (workerSid: string) =>
  db.none(`DELETE FROM "CaseAudits" $<whereClause:raw>`, {
    whereClause: caseAuditsWhereClause(workerSid),
  });
export const without = (original, ...property) => {
  if (!original) return original;
  const { ...output } = original;
  property.forEach(p => delete output[p]);
  return output;
};
export const convertCaseInfoToExpectedInfo = (input: any) => {
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
          createdAt: expect.toParseAsDate(section.createdAt),
        }));
        if (sectionName === 'counsellorNotes') {
          expectedInfo.notes = expectedInfo.counsellorNotes.map(cn => cn.note);
        }
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
          ...expectedContactModel.dataValues,
          csamReports: [],
          createdAt: expect.toParseAsDate(expectedContactModel.dataValues.createdAt),
          updatedAt: expect.toParseAsDate(expectedContactModel.dataValues.updatedAt),
        }),
      ]);
    },
  );
};

export const validateSingleCaseResponse = (actual, expectedCaseModel, expectedContactModel) => {
  validateCaseListResponse(actual, [{ case: expectedCaseModel, contact: expectedContactModel }], 1);
};

export const fillNameAndPhone = contact => {
  const modifiedContact = {
    ...contact,
    rawJson: {
      ...contact.form,
      childInformation: {
        ...contact.form.childInformation,
        name: {
          firstName: 'Maria',
          lastName: 'Silva',
        },
      },
    },
    number: '+1-202-555-0184',
  };

  delete modifiedContact.form;

  return modifiedContact;
};

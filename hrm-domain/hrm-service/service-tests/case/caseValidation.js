"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.fillNameAndPhone = exports.validateSingleCaseResponse = exports.validateCaseListResponse = void 0;
// eslint-disable-next-line import/no-extraneous-dependencies
require("@tech-matters/testing/expectToParseAsDate");
const validateCaseListResponse = (actual, expectedCases, count) => {
    expect(actual.status).toBe(200);
    if (count === 0) {
        expect(actual.body).toStrictEqual(expect.objectContaining({
            cases: [],
            count,
        }));
        return;
    }
    expect(actual.body).toStrictEqual(expect.objectContaining({
        cases: expect.arrayContaining([expect.anything()]),
        count,
    }));
    expectedCases.forEach((expectedCaseModel, index) => {
        const { ...caseDataValues } = expectedCaseModel;
        expect(actual.body.cases[index]).toMatchObject({
            ...caseDataValues,
            createdAt: expectedCaseModel.createdAt,
            updatedAt: expectedCaseModel.updatedAt,
        });
    });
};
exports.validateCaseListResponse = validateCaseListResponse;
const validateSingleCaseResponse = (actual, expectedCaseModel) => {
    (0, exports.validateCaseListResponse)(actual, [expectedCaseModel], 1);
};
exports.validateSingleCaseResponse = validateSingleCaseResponse;
const fillNameAndPhone = (contact, name = {
    firstName: 'Maria',
    lastName: 'Silva',
}, number = '+1-202-555-0184') => {
    const modifiedContact = {
        ...contact,
        rawJson: {
            ...contact.rawJson,
            childInformation: {
                ...contact.rawJson.childInformation,
                ...name,
            },
        },
        number,
    };
    delete modifiedContact.form;
    return modifiedContact;
};
exports.fillNameAndPhone = fillNameAndPhone;

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
const mockDb_1 = require("../mockDb");
const date_fns_1 = require("date-fns");
const postSurveyDataAccess_1 = require("../../post-survey/postSurveyDataAccess");
let conn;
const accountSid = 'account-sid';
beforeEach(() => {
    conn = (0, mockDb_1.mockConnection)();
});
const baselineDate = new Date(2010, 6, 1);
test('filterByContactTaskId runs query using account and contact task ids, and returns all matching post surveys.', async () => {
    const contactTaskId = 'CONTACT TASK ID';
    (0, mockDb_1.mockTask)(conn, accountSid);
    const postSurveysFromDB = [
        {
            id: '1',
            contactTaskId,
            taskId: 'TASK 1',
            data: {
                some: 'stuff',
            },
            createdAt: (0, date_fns_1.subDays)(baselineDate, 1),
            updatedAt: (0, date_fns_1.subDays)(baselineDate, 1),
        },
        {
            id: '2',
            contactTaskId,
            taskId: 'TASK 2',
            data: {
                more: 'crap',
                something: 'else',
            },
            createdAt: (0, date_fns_1.subDays)(baselineDate, 2),
            updatedAt: (0, date_fns_1.subDays)(baselineDate, 2),
        },
    ];
    const manyOrNoneSpy = jest
        .spyOn(conn, 'manyOrNone')
        .mockResolvedValue(postSurveysFromDB);
    const result = await (0, postSurveyDataAccess_1.filterByContactTaskId)(accountSid, contactTaskId);
    expect(manyOrNoneSpy).toHaveBeenCalledWith(expect.stringContaining('PostSurveys'), expect.objectContaining({ accountSid, contactTaskId }));
    expect(result).toStrictEqual(postSurveysFromDB);
});
test('create runs query using account and provided post survey object, and returns created post survey.', async () => {
    const contactTaskId = 'INSERT CONTACT TASK ID';
    (0, mockDb_1.mockTask)(conn, accountSid);
    const newPostSurvey = {
        contactTaskId,
        taskId: 'TASK 1',
        data: {
            some: 'stuff',
        },
    };
    const postSurveyFromDB = {
        ...newPostSurvey,
        id: '100',
        createdAt: baselineDate,
        updatedAt: baselineDate,
    };
    const oneSpy = jest.spyOn(conn, 'one').mockResolvedValue(postSurveyFromDB);
    const result = await (0, postSurveyDataAccess_1.create)(accountSid, newPostSurvey);
    expect(oneSpy).toHaveBeenCalledWith(expect.stringContaining(accountSid));
    expect(result).toStrictEqual(postSurveyFromDB);
});

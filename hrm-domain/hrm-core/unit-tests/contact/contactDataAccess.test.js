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
const contactDataAccess_1 = require("../../contact/contactDataAccess");
const contact_builder_1 = require("./contact-builder");
const types_1 = require("@tech-matters/types");
let conn;
beforeEach(() => {
    conn = (0, mockDb_1.mockConnection)();
});
describe('create', () => {
    const sampleNewContact = {
        rawJson: {
            childInformation: {
                firstName: 'Lorna',
                lastName: 'Ballantyne',
            },
            callType: 'carrier pigeon',
            caseInformation: {},
            categories: {},
        },
        queueName: 'Q',
        conversationDuration: 100,
        twilioWorkerId: undefined,
        timeOfContact: undefined,
        createdBy: undefined,
        helpline: undefined,
        taskId: undefined,
        channel: undefined,
        number: undefined,
        channelSid: undefined,
        serviceSid: undefined,
        isNewRecord: true,
        definitionVersion: 'as-v1',
    };
    test('Task ID specified in payload that is already associated with a contact - returns that contact', async () => {
        const returnValue = { ...new contact_builder_1.ContactBuilder().build(), isNewRecord: false };
        (0, mockDb_1.mockTransaction)(conn, undefined, 'AC parameter accountSid');
        jest.spyOn(conn, 'one').mockResolvedValue(returnValue);
        const created = await (0, contactDataAccess_1.create)()('AC parameter accountSid', sampleNewContact);
        expect(conn.one).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO'), {
            ...sampleNewContact,
            updatedAt: expect.anything(),
            createdAt: expect.anything(),
            accountSid: 'AC parameter accountSid',
        });
        const { isNewRecord, ...returnedContact } = returnValue;
        expect(created).toStrictEqual({
            ...(0, types_1.newOkFromData)({
                contact: returnedContact,
                isNewRecord: false,
            }),
            unwrap: expect.any(Function),
        });
    });
    test('Task ID specified in payload that is not already associated with a contact - creates contact as expected', async () => {
        const returnValue = { ...new contact_builder_1.ContactBuilder().build(), isNewRecord: true };
        (0, mockDb_1.mockTransaction)(conn, undefined, 'AC parameter account sid');
        jest.spyOn(conn, 'one').mockResolvedValue(returnValue);
        const created = await (0, contactDataAccess_1.create)()('AC parameter account sid', sampleNewContact);
        expect(conn.one).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO'), {
            ...sampleNewContact,
            updatedAt: expect.anything(),
            createdAt: expect.anything(),
            accountSid: 'AC parameter account sid',
        });
        const { isNewRecord, ...returnedContact } = returnValue;
        expect(created).toStrictEqual({
            ...(0, types_1.newOkFromData)({
                contact: returnedContact,
                isNewRecord: true,
            }),
            unwrap: expect.any(Function),
        });
    });
});

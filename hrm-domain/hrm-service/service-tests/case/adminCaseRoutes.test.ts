/**
 * Copyright (C) 2021-2026 Technology Matters
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

import * as caseApi from '@tech-matters/hrm-core/case/caseService';
import * as contactApi from '@tech-matters/hrm-core/contact/contactService';

import * as mocks from '../mocks';
import { adminHeaders } from '../server';
import { ALWAYS_CAN } from '../mocks';
import { setupServiceTests } from '../setupServiceTest';

const { case1, contact1, accountSid, workerSid } = mocks;

const { internalRequest } = setupServiceTests(workerSid);

describe('/admin/v0/.../cases/:caseId', () => {
  const route = id => `/admin/v0/accounts/${accountSid}/cases/${id}`;

  test('GET returns 200 for an existing case', async () => {
    const createdCase = await caseApi.createCase(
      case1,
      accountSid,
      workerSid,
      undefined,
      true,
    );

    const response = await internalRequest
      .get(route(createdCase.id))
      .set(adminHeaders)
      .send();

    expect(response.status).toBe(200);
    expect(response.body.id).toEqual(createdCase.id);
  });

  test('GET returns 404 for a nonexistent case', async () => {
    const response = await internalRequest.get(route('000000')).set(adminHeaders).send();

    expect(response.status).toBe(404);
  });

  test('DELETE with no linked contacts returns 200', async () => {
    const createdCase = await caseApi.createCase(
      case1,
      accountSid,
      workerSid,
      undefined,
      true,
    );

    const response = await internalRequest
      .delete(route(createdCase.id))
      .set(adminHeaders)
      .send();

    expect(response.status).toBe(200);
    const fromDb = await caseApi.getCase(createdCase.id, accountSid, ALWAYS_CAN);
    expect(fromDb).toBeFalsy();
  });

  test('DELETE with a linked contact returns 409, not 404 or 500', async () => {
    const createdCase = await caseApi.createCase(
      case1,
      accountSid,
      workerSid,
      undefined,
      true,
    );
    const createdContact = await contactApi.createContact(
      accountSid,
      workerSid,
      <any>contact1,
      ALWAYS_CAN,
      true,
    );
    await contactApi.connectContactToCase(
      accountSid,
      createdContact.id,
      createdCase.id,
      ALWAYS_CAN,
      true,
    );

    const response = await internalRequest
      .delete(route(createdCase.id))
      .set(adminHeaders)
      .send();

    expect(response.status).toBe(409);
  });

  test('DELETE after unlinking the only contact returns 200', async () => {
    const createdCase = await caseApi.createCase(
      case1,
      accountSid,
      workerSid,
      undefined,
      true,
    );
    const createdContact = await contactApi.createContact(
      accountSid,
      workerSid,
      <any>contact1,
      ALWAYS_CAN,
      true,
    );
    await contactApi.connectContactToCase(
      accountSid,
      createdContact.id,
      createdCase.id,
      ALWAYS_CAN,
      true,
    );
    await contactApi.connectContactToCase(
      accountSid,
      createdContact.id,
      null,
      ALWAYS_CAN,
      true,
    );

    const response = await internalRequest
      .delete(route(createdCase.id))
      .set(adminHeaders)
      .send();

    expect(response.status).toBe(200);
  });

  test('DELETE of a nonexistent case returns 404 with no audit log emitted', async () => {
    const infoSpy = jest.spyOn(console, 'info');

    const response = await internalRequest
      .delete(route('000000'))
      .set(adminHeaders)
      .send();

    expect(response.status).toBe(404);
    expect(infoSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Action: Case delete'),
    );
    infoSpy.mockRestore();
  });
});

describe('/admin/v0/.../contacts/:contactId', () => {
  test('GET returns 200 for an existing contact, 404 for a nonexistent one', async () => {
    const createdContact = await contactApi.createContact(
      accountSid,
      workerSid,
      <any>contact1,
      ALWAYS_CAN,
      true,
    );

    const found = await internalRequest
      .get(`/admin/v0/accounts/${accountSid}/contacts/${createdContact.id}`)
      .set(adminHeaders)
      .send();
    expect(found.status).toBe(200);

    const notFound = await internalRequest
      .get(`/admin/v0/accounts/${accountSid}/contacts/000000`)
      .set(adminHeaders)
      .send();
    expect(notFound.status).toBe(404);
  });
});

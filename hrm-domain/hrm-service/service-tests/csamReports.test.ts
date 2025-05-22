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

import each from 'jest-each';
import * as mocks from './mocks';
import './case/caseValidation';
import * as csamReportsApi from '@tech-matters/hrm-core/csam-report/csamReportService';
import { headers } from './server';
import { setupServiceTests } from './setupServiceTest';

const { accountSid, workerSid } = mocks;

type CreateTestPayload = Partial<Parameters<typeof csamReportsApi.createCSAMReport>[0]>;

const csamReport1: CreateTestPayload = {
  csamReportId: 'csam-report-id',
  twilioWorkerId: workerSid,
  contactId: undefined,
};

const { contact1 } = mocks;

const { request } = setupServiceTests();

describe('/csamReports', () => {
  const route = `/v0/accounts/${accountSid}/csamReports`;
  describe('POST', () => {
    test('should return 401', async () => {
      const response = await request.post(route).send(csamReport1);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authorization failed');
    });

    describe('Should return 422', () => {
      const testCases: {
        description: string;
        csamReport: CreateTestPayload;
      }[] = [
        {
          description: 'when reportType is defined but invalid',
          csamReport: {
            csamReportId: 'csam-report-id',
            twilioWorkerId: workerSid,
            reportType: 'invalid' as any,
          },
        },
        {
          description: 'when reportType is undefined and no csamReportId is provided',
          csamReport: {
            twilioWorkerId: workerSid,
          },
        },
        {
          description:
            'when reportType is "counsellor-generated" and no csamReportId is provided',
          csamReport: {
            twilioWorkerId: workerSid,
            reportType: 'counsellor-generated',
          },
        },
      ];

      each(testCases).test('$description', async ({ csamReport }) => {
        const response = await request.post(route).set(headers).send(csamReport);

        expect(response.status).toBe(422);
      });
    });

    describe('Should return 200', () => {
      describe('with valid arguments', () => {
        const testCasesWithContact: {
          description: string;
          csamReport: CreateTestPayload;
          contact?: any;
        }[] = [
          // with contact
          {
            description:
              'when reportType is "counsellor-generated", twilioWorkerId preset',
            csamReport: {
              twilioWorkerId: workerSid,
              reportType: 'counsellor-generated',
              csamReportId: 'csam-report-id',
            },
            contact: contact1,
          },
          {
            description: 'when reportType is "self-generated", twilioWorkerId preset',
            csamReport: {
              twilioWorkerId: workerSid,
              reportType: 'self-generated',
            },
            contact: contact1,
          },
          {
            description:
              'when reportType is "counsellor-generated", twilioWorkerId absent',
            csamReport: {
              reportType: 'counsellor-generated',
              csamReportId: 'csam-report-id',
            },
          },
          {
            description: 'when reportType is "self-generated", twilioWorkerId absent',
            csamReport: {
              reportType: 'self-generated',
            },
          },
        ];

        const testCases = testCasesWithContact.flatMap(
          ({ contact, description, ...rest }) => [
            { ...rest, description: description + ' without contact' },
            { ...rest, contact, description: description + ' with contact' },
          ],
        );

        each(testCases).test('$description', async ({ csamReport, contact }) => {
          let csamReportToSave;

          if (contact) {
            //Create a Contact for the contactId
            const contactRoute = `/v0/accounts/${accountSid}/contacts`;
            const contactResponse = await request
              .post(contactRoute)
              .set(headers)
              .send(contact);

            csamReportToSave = { ...csamReport, contactId: contactResponse.body.id };
          } else {
            csamReportToSave = { ...csamReport };
          }

          const expected = {
            ...csamReportToSave,
            id: expect.anything(),
            accountSid: accountSid,
            updatedAt: expect.toParseAsDate(),
            createdAt: expect.toParseAsDate(),
          };

          const response = await request.post(route).set(headers).send(csamReportToSave);

          expect(response.status).toBe(200);
          if (contact) {
            expect(response.body.contactId).toBe(csamReportToSave.contactId);
          } else {
            expect(response.body.contactId).not.toBeDefined();
          }

          const reportFromDB = await csamReportsApi.getCSAMReport(
            response.body.id,
            accountSid,
          );

          if (!reportFromDB) {
            throw new Error('reportFromDB is undefined');
          }

          expect(reportFromDB).toEqual(expect.objectContaining(expected));

          if (csamReport.reportType === 'counsellor-generated') {
            expect(reportFromDB.csamReportId).toEqual(csamReport.csamReportId);
            expect(reportFromDB.acknowledged).toBe(true);
          } else {
            expect(reportFromDB.csamReportId).toBeDefined();
            expect(reportFromDB.acknowledged).toBe(false);
          }

          if (csamReport.twilioWorkerId) {
            expect(reportFromDB.twilioWorkerId).toBe(csamReport.twilioWorkerId);
          } else {
            expect(reportFromDB.twilioWorkerId).toBe(null);
          }
        });
      });
    });

    describe('Should return 500', () => {
      const testCases: {
        description: string;
        csamReport: CreateTestPayload;
      }[] = [
        {
          description: 'when reportType is "counsellor-generated"',
          csamReport: {
            twilioWorkerId: workerSid,
            reportType: 'counsellor-generated',
            csamReportId: 'csam-report-id',
            contactId: '99999999',
          },
        },
        {
          description: 'when reportType is "self-generated"',
          csamReport: {
            twilioWorkerId: workerSid,
            reportType: 'self-generated',
            csamReportId: 'csam-report-id',
            contactId: '99999999',
          },
        },
      ];

      each(testCases).test('Invalid contactId, $description', async ({ csamReport }) => {
        const response = await request.post(route).set(headers).send(csamReport);

        expect(response.status).toBe(500);
        expect(response.body.message).toContain(
          'insert or update on table "CSAMReports" violates foreign key constraint "CSAMReports_contactId_accountSid_fkey"',
        );
      });

      each(testCases).test('Invalid accountSid, $description', async ({ csamReport }) => {
        //Create a Contact for the contactId
        const contactRoute = `/v0/accounts/${accountSid}/contacts`;
        const contactResponse = await request
          .post(contactRoute)
          .set(headers)
          .send(contact1);
        let csamReportWithContactId = {
          ...csamReport,
          contactId: contactResponse.body.id,
        };

        const response = await request
          .post(route.replace(accountSid, 'another-account-sid'))
          .set(headers)
          .send(csamReportWithContactId);

        expect(response.status).toBe(500);
        expect(response.body.message).toContain(
          'insert or update on table "CSAMReports" violates foreign key constraint "CSAMReports_contactId_accountSid_fkey"',
        );
      });
    });
  });

  describe('/:reportId', () => {
    describe('/acknowledge', () => {
      describe('POST', () => {
        describe('Should return 404', () => {
          each([
            {
              description: 'when reportId is a string',
              reportId: 'a-string',
            },
            {
              description: 'when reportId does not exists in DB',
              reportId: 99999999,
            },
          ]).test('$description', async ({ reportId }) => {
            const response = await request
              .post(`${route}/${reportId}/acknowledge`)
              .set(headers);

            expect(response.status).toBe(404);
          });
        });

        describe('Should return 200', () => {
          const testCasesWithContact: {
            description: string;
            csamReport?: CreateTestPayload;
            contact: any;
          }[] = [
            {
              description: 'with "counsellor-generated" is no-op',
              csamReport: {
                twilioWorkerId: workerSid,
                reportType: 'counsellor-generated',
                csamReportId: 'csam-report-id',
              },
              contact: contact1,
            },
            {
              description: 'with "self-generated", sets "acknowledged" to TRUE',
              csamReport: {
                twilioWorkerId: workerSid,
                reportType: 'self-generated',
              },
              contact: contact1,
            },
          ];

          const testCases = testCasesWithContact.flatMap(
            ({ contact, description, ...rest }) => [
              { ...rest, description: description + ' without contact' },
              { ...rest, contact, description: description + ' with contact' },
            ],
          );

          each(testCases).test('$description', async ({ csamReport, contact }) => {
            let csamReportToSave;

            if (contact) {
              //Create a Contact for the contactId
              const contactRoute = `/v0/accounts/${accountSid}/contacts`;
              const contactResponse = await request
                .post(contactRoute)
                .set(headers)
                .send(contact);

              csamReportToSave = { ...csamReport, contactId: contactResponse.body.id };
            } else {
              csamReportToSave = { ...csamReport };
            }

            const createdReport = await csamReportsApi.createCSAMReport(
              csamReportToSave,
              accountSid,
            );

            const response = await request
              .post(`${route}/${createdReport.id}/acknowledge`)
              .set(headers)
              .send({});

            expect(response.status).toBe(200);
            expect(response.body.acknowledged).toBe(true);
          });
        });
      });
    });
  });
});

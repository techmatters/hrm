import supertest from 'supertest';
import each from 'jest-each';
import { createService } from '../src/app';
import * as mocks from './mocks';
import './case-validation';
import { openPermissions } from '../src/permissions/json-permissions';
import * as proxiedEndpoints from './external-service-stubs/proxied-endpoints';
import { db } from '../src/connection-pool';
import * as csamReportsApi from '../src/csam-report/csam-report';

console.log(process.env.INCLUDE_ERROR_IN_RESPONSE);

const server = createService({
  permissions: openPermissions,
  authTokenLookup: () => 'picernic basket',
  enableProcessContactJobs: false,
}).listen();
const request = supertest.agent(server);

const { accountSid, workerSid } = mocks;

const csamReport1: Partial<csamReportsApi.CreateCSAMReport> = {
  csamReportId: 'csam-report-id',
  twilioWorkerId: workerSid,
  contactId: undefined,
};

const { contact1 } = mocks;

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer bearing a bear (rawr)`,
};

const whereTwilioWorkerIdClause = `WHERE "accountSid" = '${accountSid}' AND ("twilioWorkerId" = '${workerSid}' OR "twilioWorkerId" IS NULL)`;

const cleanupContacts = async () =>
  db.task(t => t.none(`DELETE FROM "Contacts" ${whereTwilioWorkerIdClause}`));

const cleanupCsamReports = async () =>
  db.task(t => t.none(`DELETE FROM "CSAMReports" ${whereTwilioWorkerIdClause}`));

beforeAll(async () => {
  await proxiedEndpoints.start();
  await proxiedEndpoints.mockSuccessfulTwilioAuthentication(workerSid);
  await cleanupCsamReports();
  await cleanupContacts();
});

afterAll(async () => {
  await cleanupCsamReports();
  await cleanupContacts();
  await proxiedEndpoints.stop();
  await server.close();
  console.log('csam reports test cleaned up.');
});

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
        csamReport: Partial<csamReportsApi.CreateCSAMReport>;
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
          description: 'when reportType is "counsellor-generated" and no csamReportId is provided',
          csamReport: {
            twilioWorkerId: workerSid,
            reportType: 'counsellor-generated',
          },
        },
      ];

      each(testCases).test('$description', async ({ csamReport }) => {
        const response = await request
          .post(route)
          .set(headers)
          .send(csamReport);

        expect(response.status).toBe(422);
      });
    });

    describe('Should return 200', () => {
      describe('with valid arguments', () => {
        const testCasesWithContact: {
          description: string;
          csamReport: Partial<csamReportsApi.CreateCSAMReport>;
          contact?: any;
        }[] = [
          // with contact
          {
            description: 'when reportType is "counsellor-generated", twilioWorkerId preset',
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
            description: 'when reportType is "counsellor-generated", twilioWorkerId absent',
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

        const testCases = testCasesWithContact.flatMap(({ contact, description, ...rest }) => [
          { ...rest, description: description + ' without contact' },
          { ...rest, contact, description: description + ' with contact' },
        ]);

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

          const response = await request
            .post(route)
            .set(headers)
            .send(csamReportToSave);

          expect(response.status).toBe(200);
          if (contact) {
            expect(response.body.contactId).toBe(csamReportToSave.contactId);
          } else {
            expect(response.body.contactId).toBeNull();
          }

          const reportFromDB = await csamReportsApi.getCSAMReport(response.body.id, accountSid);

          if (!reportFromDB) {
            throw new Error('reportFromDB is undefined');
          }

          expect(reportFromDB).toEqual(expect.objectContaining(expected));

          if (csamReport.reportType === 'counsellor-generated') {
            expect(reportFromDB.csamReportId).toEqual(csamReport.csamReportId);
            expect(reportFromDB.aknowledged).toBe(true);
          } else {
            expect(reportFromDB.csamReportId).toBeDefined();
            expect(reportFromDB.aknowledged).toBe(false);
          }

          if (csamReport.twilioWorkerId) {
            expect(reportFromDB.twilioWorkerId).toBe(csamReport.twilioWorkerId);
          } else {
            expect(reportFromDB.twilioWorkerId).toBe('');
          }
        });
      });
    });

    describe('Should return 500', () => {
      const testCases: {
        description: string;
        csamReport: Partial<csamReportsApi.CreateCSAMReport>;
      }[] = [
        {
          description: 'when reportType is "counsellor-generated"',
          csamReport: {
            twilioWorkerId: workerSid,
            reportType: 'counsellor-generated',
            csamReportId: 'csam-report-id',
            contactId: 99999999,
          },
        },
        {
          description: 'when reportType is "self-generated"',
          csamReport: {
            twilioWorkerId: workerSid,
            reportType: 'self-generated',
            csamReportId: 'csam-report-id',
            contactId: 99999999,
          },
        },
      ];

      each(testCases).test('Invalid contactId, $description', async ({ csamReport }) => {
        const response = await request
          .post(route)
          .set(headers)
          .send(csamReport);

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
        let csamReportWithContactId = { ...csamReport, contactId: contactResponse.body.id };

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
    describe('DELETE', () => {
      describe('Should return 422', () => {
        each([
          {
            description: 'when reportId is a string',
            reportId: 'a-string',
          },
        ]).test('$description', async reportId => {
          const response = await request.delete(`${route}/${reportId}`).set(headers);

          expect(response.status).toBe(422);
        });
      });

      describe('Should return 200', () => {
        const testCases: {
          description: string;
          csamReport?: Partial<csamReportsApi.CreateCSAMReport>;
          contact?: any;
          reportId?: number;
        }[] = [
          {
            description: 'if exists, is deleted with "counsellor-generated"',
            csamReport: {
              twilioWorkerId: workerSid,
              reportType: 'counsellor-generated',
              csamReportId: 'csam-report-id',
            },
          },
          {
            description: 'if exists, is deleted with "self-generated"',
            csamReport: {
              twilioWorkerId: workerSid,
              reportType: 'self-generated',
            },
          },
          {
            description: 'if not exists, is a no-op',
            reportId: 999999,
          },
        ];

        each(testCases).test('$description', async ({ csamReport, reportId }) => {
          let reportIdToDelete: number;

          if (csamReport) {
            const createdReport = await csamReportsApi.createCSAMReport(csamReport, accountSid);
            reportIdToDelete = createdReport.id;
          } else {
            reportIdToDelete = reportId;
          }

          expect(reportIdToDelete).toBeDefined();

          const response = await request.delete(`${route}/${reportIdToDelete}`).set(headers);

          expect(response.status).toBe(200);

          const shouldntExistReport = await csamReportsApi.getCSAMReport(
            reportIdToDelete,
            accountSid,
          );

          expect(shouldntExistReport).toBeNull();
        });
      });
    });

    describe('/aknowledge', () => {
      describe('PATCH', () => {
        describe('Should return 422', () => {
          each([
            {
              description: 'when reportId is a string',
              reportId: 'a-string',
            },
          ]).test('$description', async ({ reportId }) => {
            const response = await request.patch(`${route}/${reportId}/aknowledge`).set(headers);

            expect(response.status).toBe(422);
          });
        });

        describe('Should return 404', () => {
          each([
            {
              description: 'when reportId does not exists in DB',
              reportId: 99999999,
            },
          ]).test('$description', async ({ reportId }) => {
            const response = await request.patch(`${route}/${reportId}/aknowledge`).set(headers);

            expect(response.status).toBe(404);
          });
        });

        describe('Should return 200', () => {
          const testCasesWithContact: {
            description: string;
            csamReport?: Partial<csamReportsApi.CreateCSAMReport>;
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
              description: 'with "self-generated", sets "aknowledged" to TRUE',
              csamReport: {
                twilioWorkerId: workerSid,
                reportType: 'self-generated',
              },
              contact: contact1,
            },
          ];

          const testCases = testCasesWithContact.flatMap(({ contact, description, ...rest }) => [
            { ...rest, description: description + ' without contact' },
            { ...rest, contact, description: description + ' with contact' },
          ]);

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
              .patch(`${route}/${createdReport.id}/aknowledge`)
              .set(headers)
              .send({});

            expect(response.status).toBe(200);
            expect(response.body.aknowledged).toBe(true);
          });
        });
      });
    });
  });
});

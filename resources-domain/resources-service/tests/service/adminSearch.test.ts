import sqslite from 'sqslite';
import { adminHeaders, getInternalServer, getRequest, headers, internalHeaders } from './server';
import { SearchReindexParams } from '../../src/admin/adminSearchService';
import { mockingProxy, mockSuccessfulTwilioAuthentication } from '@tech-matters/testing';
import { addDays, parseISO, subDays } from 'date-fns';
import each from 'jest-each';
import { AccountSID, FlatResource, ImportRequestBody, ResourcesJobType } from '@tech-matters/types';
import { generateImportResource as newImportResourceGenerator } from '../mockResources';
import range from './range';
import { SQS } from 'aws-sdk';
import { db } from '../../src/connection-pool';

const internalServer = getInternalServer();
const internalRequest = getRequest(internalServer);

const WORKER_SID = 'WK-worker-sid';

const BASELINE_DATE = parseISO('2020-01-01T00:00:00.000Z');

const ACCOUNT_SIDS: AccountSID[] = range(3).map(accountIdx => `AC${accountIdx}` as const);

const sqsService = sqslite({});
const sqsClient = new SQS({
  endpoint: `http://localhost:${process.env.LOCAL_SQS_PORT}`,
});

let testQueueUrl: URL;

beforeAll(async () => {
  await mockingProxy.start();
  await sqsService.listen({ port: parseInt(process.env.LOCAL_SQS_PORT!) });
  const queues = await sqsClient.listQueues().promise();
  console.log('Queues', queues);
  await mockSuccessfulTwilioAuthentication(WORKER_SID);
  const mockttp = await mockingProxy.mockttpServer();
  await mockttp.forPost(/(.*)mock-ssm(.*)/).thenCallback(async req => {
    const { Name: name }: { Name: string } = ((await req.body.getJson()) as { Name: string }) ?? {
      Name: '',
    };
    if (/\/(test|local|development)\/resources\/AC[0-9]+\/queue-url-search-index/.test(name)) {
      return {
        status: 200,
        body: JSON.stringify({
          Parameter: {
            ARN: 'string',
            DataType: 'text',
            LastModifiedDate: 0,
            Name: name,
            Selector: 'string',
            SourceResult: 'string',
            Type: 'SecureString',
            Value: testQueueUrl.toString(),
            Version: 3,
          },
        }),
      };
    } else {
      return { status: 404 };
    }
  });
  ACCOUNT_SIDS.forEach(accountSid => {
    process.env[`STATIC_KEY_${accountSid}`] = 'BBC';
  });
});

afterAll(async () => Promise.all([mockingProxy.stop(), internalServer.close()]));

beforeEach(async () => {
  const { QueueUrl } = await sqsClient
    .createQueue({
      QueueName: `test-hrm-resources-search-index-pending`,
    })
    .promise();
  testQueueUrl = new URL(QueueUrl!);
});

afterEach(async () => {
  await sqsClient
    .deleteQueue({
      QueueUrl: testQueueUrl.toString(),
    })
    .promise();
});

describe('POST /search/reindex', () => {
  const route = `/v0/resources/admin/search/reindex`;

  test('No static key - should return 401', async () => {
    const requestBody: SearchReindexParams = {
      lastUpdatedFrom: BASELINE_DATE.toISOString(),
    };
    internalRequest
      .post(route)
      .send(requestBody)
      .expect(401);
  });

  test('Incorrect static key - should return 401', async () => {
    const requestBody: SearchReindexParams = {
      lastUpdatedFrom: BASELINE_DATE.toISOString(),
    };
    internalRequest
      .post(route)
      .set({ ...adminHeaders, Authorization: `Basic C64` })
      .send(requestBody)
      .expect(401);
  });

  test('Twilio Flex creds - should return 401', async () => {
    const requestBody: SearchReindexParams = {
      lastUpdatedFrom: BASELINE_DATE.toISOString(),
    };
    internalRequest
      .post(route)
      .set(headers)
      .send(requestBody)
      .expect(401);
  });

  describe('Date range parameters', () => {
    const dbResources = range(3).map(accountIdx => {
      const accountSid: AccountSID = `AC${accountIdx}`;
      const generateImportResource = newImportResourceGenerator(BASELINE_DATE, accountSid);
      const accountResources: FlatResource[] = range(10).map(resourceIdx => {
        return generateImportResource(
          resourceIdx,
          addDays(BASELINE_DATE, parseInt(resourceIdx) - 5),
        );
      });
      return [accountSid, accountResources] as const;
    });

    type DateRangeTestCase = {
      description: string;
      lastUpdatedFrom?: Date;
      lastUpdatedTo?: Date;
      accountSid?: AccountSID;
      expectedResourcesPublished: FlatResource[];
    };

    const testCases: DateRangeTestCase[] = [
      {
        description:
          'Only lastUpdatedFrom set - sends all resources updated after that date for any account to be reindexed',
        lastUpdatedFrom: BASELINE_DATE,
        expectedResourcesPublished: dbResources
          .flatMap(([, resources]) => resources)
          .sort((a, b) => {
            if (a.lastUpdated === b.lastUpdated) {
              if (a.accountSid === b.accountSid) {
                return a.id > b.id ? 1 : -1;
              }
              return a.accountSid > b.accountSid ? 1 : -1;
            }
            return a.lastUpdated > b.lastUpdated ? 1 : -1;
          })
          .filter(resource => parseISO(resource.lastUpdated) >= BASELINE_DATE),
      },
    ];

    beforeAll(async () => {
      await db.task(tx =>
        tx.none(
          ACCOUNT_SIDS.map(
            accountSids => `INSERT INTO resources."ResourceReferenceStringAttributeValues" (id, "accountSid", "list", "value", "language")
                        VALUES (
                            'REF_1_2',
                            '${accountSids}',
                            'REFERENCE_LIST_1',
                            'REFERENCE_VALUE_2',
                            'REFERENCE_LANGUAGE')`,
          ).join('\n;'),
        ),
      );
      await Promise.all(
        dbResources.map(([acc, accountResources]) => {
          const body: ImportRequestBody = {
            importedResources: accountResources,
            batch: {
              fromDate: subDays(BASELINE_DATE, 10).toISOString(),
              toDate: addDays(BASELINE_DATE, 10).toISOString(),
              remaining: 10,
            },
          };
          return internalRequest
            .post(`/v0/accounts/${acc}/resources/import`)
            .set(internalHeaders)
            .send(body);
        }),
      );
    });

    each(testCases).test(
      '$description',
      async ({ lastUpdatedFrom, expectedResourcesPublished }: DateRangeTestCase) => {
        const requestBody: SearchReindexParams = {
          lastUpdatedFrom: lastUpdatedFrom?.toISOString(),
        };
        await internalRequest
          .post(route)
          .set(adminHeaders)
          .send(requestBody)
          .expect(200);
        const receivedMessages: FlatResource[] = [];
        while (receivedMessages.length <= expectedResourcesPublished.length) {
          const { Messages } = await sqsClient
            .receiveMessage({
              QueueUrl: testQueueUrl.toString(),
              MaxNumberOfMessages: 10,
              WaitTimeSeconds: 0.5,
            })
            .promise();
          if (!Messages?.length) {
            break;
          }
          receivedMessages.push(...(Messages ?? []).map(message => JSON.parse(message.Body ?? '')));
        }
        expect(receivedMessages.length).toEqual(expectedResourcesPublished.length);
        const expectedMessages = expectedResourcesPublished.map(resource => ({
          accountSid: resource.accountSid,
          document: resource,
          jobType: ResourcesJobType.SEARCH_INDEX,
        }));
        expect(receivedMessages).toStrictEqual(expectedMessages);
      },
      60000,
    );
  });
});

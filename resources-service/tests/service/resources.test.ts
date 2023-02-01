import { mockingProxy, mockSuccessfulTwilioAuthentication } from '@tech-matters/testing';
import { headers, getRequest, getServer } from './server';
import { db } from '../../src/connection-pool';
import each from 'jest-each';
import { ReferrableResource } from '../../src/resource/resource-data-access';

export const workerSid = 'WK-worker-sid';

const server = getServer();
const request = getRequest(server);

afterAll(done => {
  mockingProxy.stop().finally(() => {
    server.close(done);
  });
});

const range = (elements: number): string[] =>
  Array.from(Array(elements).keys()).map(i => i.toString());

beforeAll(async () => {
  await mockingProxy.start();
  await mockSuccessfulTwilioAuthentication(workerSid);
  const accountResourceIdTuples: [string, string[]][] = [
    ['1', range(5)],
    ['2', range(2)],
  ];
  await db.multi(
    accountResourceIdTuples
      .flatMap(([accountIdx, resourceIdxs]) =>
        resourceIdxs.map(
          resourceIdx =>
            `INSERT INTO resources."Resources" (id, "accountSid", "name") VALUES ('RESOURCE_${resourceIdx}', 'ACCOUNT_${accountIdx}', 'Resource ${resourceIdx} (Account ${accountIdx})')`,
        ),
      )
      .join(';'),
  );
});

describe('GET /resource', () => {
  const basePath = '/v0/accounts/ACCOUNT_1/resources/resource';

  test('Should return 401 unauthorized with no auth headers', async () => {
    const response = await request.get(`${basePath}/RESOURCE_1`);
    console.log(response.status);
    console.log(response.body);
    expect(response.status).toBe(401);
    expect(response.body).toStrictEqual({ error: 'Authorization failed' });
  });

  test('Should return a 200 response with a single resource object', async () => {
    const response = await request.get(`${basePath}/RESOURCE_1`).set(headers);
    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({
      id: 'RESOURCE_1',
      name: 'Resource 1 (Account 1)',
    });
  });
});

describe('POST /search', () => {
  const basePath = '/v0/accounts/ACCOUNT_1/resources/search';

  test('Should return 401 unauthorized with no auth headers', async () => {
    const response = await request.post(`${basePath}?start=0&limit=5`).send({
      nameSubstring: 'Resource',
    });
    expect(response.status).toBe(401);
    expect(response.body).toStrictEqual({ error: 'Authorization failed' });
  });

  each([
    {
      parameters: { nameSubstring: 'Resource' },
      limit: '3',
      condition: 'a matching name substring, a limit and no ids',
      expectationDescription:
        'resources where their name contains the term, up to limit in ascending name order',
      expectedResults: [
        {
          id: 'RESOURCE_0',
          name: 'Resource 0 (Account 1)',
        },
        {
          id: 'RESOURCE_1',
          name: 'Resource 1 (Account 1)',
        },
        {
          id: 'RESOURCE_2',
          name: 'Resource 2 (Account 1)',
        },
      ],
      expectedTotalCount: 5,
    },
    {
      parameters: { nameSubstring: 'Resource' },
      limit: '3',
      start: '2',
      condition: 'a matching name substring, a limit and no ids, with an offset',
      expectationDescription:
        'resources where their name contains the term, up to limit in ascending name order',
      expectedResults: [
        {
          id: 'RESOURCE_2',
          name: 'Resource 2 (Account 1)',
        },
        {
          id: 'RESOURCE_3',
          name: 'Resource 3 (Account 1)',
        },
        {
          id: 'RESOURCE_4',
          name: 'Resource 4 (Account 1)',
        },
      ],
      expectedTotalCount: 5,
    },
    {
      parameters: { nameSubstring: 'Resource' },
      limit: '10',
      condition: 'a matching name substring, a limit larger than the result set no ids',
      expectationDescription: 'all resources where their name contains the term',
      expectedResults: [
        {
          id: 'RESOURCE_0',
          name: 'Resource 0 (Account 1)',
        },
        {
          id: 'RESOURCE_1',
          name: 'Resource 1 (Account 1)',
        },
        {
          id: 'RESOURCE_2',
          name: 'Resource 2 (Account 1)',
        },
        {
          id: 'RESOURCE_3',
          name: 'Resource 3 (Account 1)',
        },
        {
          id: 'RESOURCE_4',
          name: 'Resource 4 (Account 1)',
        },
      ],
      expectedTotalCount: 5,
    },
    {
      parameters: { nameSubstring: 'Resource' },
      start: '10',
      condition: 'a matching name substring, a start point past the end of the result set, no ids',
      expectationDescription: 'no resources but a correct totalCount',
      expectedResults: [],
      expectedTotalCount: 5,
    },
    {
      parameters: { nameSubstring: 'Resource 3', ids: ['RESOURCE_0', 'RESOURCE_2', 'RESOURCE_1'] },
      limit: '10',
      condition: 'a matching name substring, and matching ids',
      expectationDescription:
        'all resources where their name contains the term and specified IDs, with specified IDs at the end',
      expectedResults: [
        {
          id: 'RESOURCE_3',
          name: 'Resource 3 (Account 1)',
        },
        {
          id: 'RESOURCE_0',
          name: 'Resource 0 (Account 1)',
        },
        {
          id: 'RESOURCE_2',
          name: 'Resource 2 (Account 1)',
        },
        {
          id: 'RESOURCE_1',
          name: 'Resource 1 (Account 1)',
        },
      ],
      expectedTotalCount: 4,
    },
    {
      parameters: { nameSubstring: 'Resource 3', ids: ['RESOURCE_0', 'RESOURCE_2', 'RESOURCE_1'] },
      start: '2',
      condition: 'a matching name substring, and matching ids with offset in id range',
      expectationDescription: 'remaining ID resources',
      expectedResults: [
        {
          id: 'RESOURCE_2',
          name: 'Resource 2 (Account 1)',
        },
        {
          id: 'RESOURCE_1',
          name: 'Resource 1 (Account 1)',
        },
      ],
      expectedTotalCount: 4,
    },
    {
      parameters: {
        nameSubstring: 'Resource 3',
        ids: ['RESOURCE_0', 'RESOURCE_2', 'RESOURCE_1', 'RESOURCE_4'],
      },
      start: '2',
      limit: '2',
      condition: 'a matching name substring, and matching ids with whole window in id range',
      expectationDescription: 'ID resources from correct position in list',
      expectedResults: [
        {
          id: 'RESOURCE_2',
          name: 'Resource 2 (Account 1)',
        },
        {
          id: 'RESOURCE_1',
          name: 'Resource 1 (Account 1)',
        },
      ],
      expectedTotalCount: 5,
    },
    {
      parameters: {
        ids: ['RESOURCE_0', 'RESOURCE_2', 'NOT_A_RESOURCE', 'RESOURCE_1'],
      },
      limit: '10',
      condition: 'ids with missing ids',
      expectationDescription: 'only resources that match IDs are returned',
      expectedResults: [
        {
          id: 'RESOURCE_0',
          name: 'Resource 0 (Account 1)',
        },
        {
          id: 'RESOURCE_2',
          name: 'Resource 2 (Account 1)',
        },
        {
          id: 'RESOURCE_1',
          name: 'Resource 1 (Account 1)',
        },
      ],
      expectedTotalCount: 3,
    },
    {
      parameters: {
        ids: ['RESOURCE_0', 'RESOURCE_2', 'RESOURCE_0', 'RESOURCE_1', 'RESOURCE_2'],
      },
      limit: '10',
      condition: 'ids with duplicates',
      expectationDescription: 'only one resource per unique ID is returned',
      expectedResults: [
        {
          id: 'RESOURCE_0',
          name: 'Resource 0 (Account 1)',
        },
        {
          id: 'RESOURCE_2',
          name: 'Resource 2 (Account 1)',
        },
        {
          id: 'RESOURCE_1',
          name: 'Resource 1 (Account 1)',
        },
      ],
      expectedTotalCount: 3,
    },
  ]).test(
    'When specifying $condition, should return a 200 response and $expectationDescription',
    async ({
      parameters: { nameSubstring, ids } = {},
      limit,
      start,
      expectedResults,
      expectedTotalCount,
    }: {
      parameters: {
        nameSubstring?: string;
        ids?: string[];
      };
      limit?: string;
      start?: string;
      expectedResults: ReferrableResource[];
      expectedTotalCount: number;
    }) => {
      let qs = Object.entries({ limit, start })
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}=${v}`)
        .join('&');
      const url = `${basePath}${qs.length ? '?' : ''}${qs}`;
      console.log('POST', url, {
        nameSubstring,
        ids,
      });
      const response = await request
        .post(url)
        .set(headers)
        .send({
          nameSubstring,
          ids,
        });
      expect(response.status).toBe(200);
      expect(response.body).toStrictEqual({
        results: expectedResults,
        totalCount: expectedTotalCount,
      });
    },
  );
});

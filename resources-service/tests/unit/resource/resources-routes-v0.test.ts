import { Request, Response, Router } from 'express';
import resourceRoutes from '../../../src/resource/resource-routes-v0';
import { searchResources } from '../../../src/resource/resource-model';
import { ReferrableResource } from '../../../src/resource/resource-data-access';

jest.mock('express', () => ({
  Router: jest.fn(),
}));

jest.mock('../../../src/resource/resource-model', () => ({
  searchResources: jest.fn(),
}));

const mockRouterConstructor = Router as jest.Mock;
const mockSearchResources = searchResources as jest.Mock<
  Promise<{ totalCount: number; results: ReferrableResource[] }>
>;

beforeEach(() => {
  mockRouterConstructor.mockReset();
});

describe('POST /resource/search', () => {
  type SearchRequestHandler = (
    req: Request<{ nameSubstring: string; ids: string[] }>,
    res: Response,
  ) => Promise<void>;

  let searchRequestHandler: SearchRequestHandler;
  const response: Response = { json: jest.fn() } as any;
  const mockResponseJson = response.json as jest.Mock;

  beforeEach(() => {
    mockResponseJson.mockReset();
    mockRouterConstructor.mockImplementation(() => ({
      post: (path: string, handler: SearchRequestHandler) => {
        if (path === '/resource/search') {
          searchRequestHandler = handler;
        }
      },
      get: () => {},
    }));
    resourceRoutes();
  });

  test('Takes limit & start from query string, search parameters from body and returns resources from model as JSON', async () => {
    const modelResult = {
      totalCount: 100,
      results: [
        { id: 'RESOURCE_1', name: 'Resource 1' },
        { id: 'RESOURCE_2', name: 'Resource 2' },
      ],
    };
    mockSearchResources.mockResolvedValue(modelResult);
    await searchRequestHandler(
      {
        query: { limit: '1337', start: '42' } as any,
        body: { nameSubstring: 'Reso', ids: ['RESOURCE_1', 'RESOURCE_2', 'RESOURCE_3'] },
        accountSid: 'AC1',
      } as Request<{ nameSubstring: string; ids: string[] }>,
      response,
    );
    expect(mockSearchResources).toHaveBeenCalledWith('AC1', {
      nameSubstring: 'Reso',
      ids: ['RESOURCE_1', 'RESOURCE_2', 'RESOURCE_3'],
      pagination: { limit: 1337, start: 42 },
    });
    expect(response.json).toHaveBeenCalledWith(modelResult);
  });

  test('limit & start absent from query string - substitutes 20 and 0 respectively', async () => {
    const modelResult = {
      totalCount: 100,
      results: [],
    };
    mockSearchResources.mockResolvedValue(modelResult);
    await searchRequestHandler(
      {
        query: {} as any,
        body: { nameSubstring: 'Reso', ids: ['RESOURCE_1', 'RESOURCE_2', 'RESOURCE_3'] },
        accountSid: 'AC1',
      } as Request<{ nameSubstring: string; ids: string[] }>,
      response,
    );
    expect(mockSearchResources).toHaveBeenCalledWith('AC1', {
      nameSubstring: 'Reso',
      ids: ['RESOURCE_1', 'RESOURCE_2', 'RESOURCE_3'],
      pagination: { limit: 20, start: 0 },
    });
    expect(response.json).toHaveBeenCalledWith(modelResult);
  });

  test('limit & start not numbers - substitutes 20 and 0 respectively', async () => {
    const modelResult = {
      totalCount: 100,
      results: [],
    };
    mockSearchResources.mockResolvedValue(modelResult);
    await searchRequestHandler(
      {
        query: { limit: 'some', start: 'crap' } as any,
        body: { nameSubstring: 'Reso', ids: ['RESOURCE_1', 'RESOURCE_2', 'RESOURCE_3'] },
        accountSid: 'AC1',
      } as Request<{ nameSubstring: string; ids: string[] }>,
      response,
    );
    expect(mockSearchResources).toHaveBeenCalledWith('AC1', {
      nameSubstring: 'Reso',
      ids: ['RESOURCE_1', 'RESOURCE_2', 'RESOURCE_3'],
      pagination: { limit: 20, start: 0 },
    });
    expect(response.json).toHaveBeenCalledWith(modelResult);
  });
  test('nameSubstring and ids missing - calls model without them', async () => {
    const modelResult = {
      totalCount: 100,
      results: [],
    };
    mockSearchResources.mockResolvedValue(modelResult);
    await searchRequestHandler(
      {
        query: {} as any,
        body: {},
        accountSid: 'AC1',
      } as Request<{ nameSubstring: string; ids: string[] }>,
      response,
    );
    expect(mockSearchResources).toHaveBeenCalledWith('AC1', {
      pagination: { limit: 20, start: 0 },
    });
    expect(response.json).toHaveBeenCalledWith(modelResult);
  });
  test('request body missing - calls model with no search parameters', async () => {
    const modelResult = {
      totalCount: 100,
      results: [],
    };
    mockSearchResources.mockResolvedValue(modelResult);
    await searchRequestHandler(
      {
        query: {} as any,
        accountSid: 'AC1',
      } as Request<{ nameSubstring: string; ids: string[] }>,
      response,
    );
    expect(mockSearchResources).toHaveBeenCalledWith('AC1', {
      pagination: { limit: 20, start: 0 },
    });
    expect(response.json).toHaveBeenCalledWith(modelResult);
  });
});

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

import { Request, Response, Router } from 'express';
import resourceRoutes from '../../../src/resource/resource-routes-v0';
import { ReferrableResource, searchResources } from '../../../src/resource/resource-model';

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

describe('POST /search', () => {
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
        if (path === '/search') {
          searchRequestHandler = handler;
        }
      },
      get: () => {},
    }));
    resourceRoutes();
  });

  test('Takes limit & start from query string, search parameters from body and returns resources from model as JSON', async () => {
    const modelResult: { totalCount: number; results: ReferrableResource[] } = {
      totalCount: 100,
      results: [
        {
          id: 'RESOURCE_1',
          name: 'Resource 1',
          attributes: {
            someAttribute: [
              { value: 'some value', language: 'en-US' },
              { value: 'some value', language: 'fr-FR' },
            ],
          },
        },
        { id: 'RESOURCE_2', name: 'Resource 2', attributes: {} },
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

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

import { HrmAccountId } from '@tech-matters/types';
import { ReferrableResource } from '@tech-matters/resources-types';
import { SearchParameters } from '@tech-matters/resources-search-config';

import { Request, Response, Router } from 'express';
import resourceRoutes from '../../../src/resource/resourceRoutesV0';
import { resourceService } from '../../../src/resource/resourceService';

jest.mock('express', () => ({
  Router: jest.fn(),
}));

jest.mock('../../../src/resource/resourceService', () => ({
  resourceService: jest.fn(),
}));

const mockSearchResources: jest.Mock<
  Promise<{
    totalCount: number;
    results: ReferrableResource[];
  }>
> = jest.fn();

(<jest.Mock>resourceService).mockReturnValue({
  searchResources: mockSearchResources,
});

const mockRouterConstructor = Router as jest.Mock;

beforeEach(() => {
  mockRouterConstructor.mockReset();
});

describe('POST /search', () => {
  type SearchRequestHandler = (
    req: Partial<Request<Partial<SearchParameters>>> & { hrmAccountId: HrmAccountId },
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
        body: { generalSearchTerm: 'Reso' },
        hrmAccountId: 'AC1',
      },
      response,
    );
    expect(mockSearchResources).toHaveBeenCalledWith('AC1', {
      generalSearchTerm: 'Reso',
      filters: {},
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
        body: { generalSearchTerm: 'Reso' },
        hrmAccountId: 'AC1',
      },
      response,
    );
    expect(mockSearchResources).toHaveBeenCalledWith('AC1', {
      generalSearchTerm: 'Reso',
      filters: {},
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
        body: { generalSearchTerm: 'Reso' },
        hrmAccountId: 'AC1',
      },
      response,
    );
    expect(mockSearchResources).toHaveBeenCalledWith('AC1', {
      generalSearchTerm: 'Reso',
      filters: {},
      pagination: { limit: 20, start: 0 },
    });
    expect(response.json).toHaveBeenCalledWith(modelResult);
  });
  test('generalSearchTerm and filters present - calls service with them', async () => {
    const modelResult = {
      totalCount: 100,
      results: [],
    };
    mockSearchResources.mockResolvedValue(modelResult);
    await searchRequestHandler(
      {
        query: {} as any,
        body: {
          generalSearchTerm: 'Reso',
          filters: {
            some: 'filter',
          },
        },
        hrmAccountId: 'AC1',
      },
      response,
    );
    expect(mockSearchResources).toHaveBeenCalledWith('AC1', {
      generalSearchTerm: 'Reso',
      filters: {
        some: 'filter',
      },
      pagination: { limit: 20, start: 0 },
    });
    expect(response.json).toHaveBeenCalledWith(modelResult);
  });
  test('generalSearchTerm and filters missing - calls service without them', async () => {
    const modelResult = {
      totalCount: 100,
      results: [],
    };
    mockSearchResources.mockResolvedValue(modelResult);
    await searchRequestHandler(
      {
        query: {} as any,
        body: {},
        hrmAccountId: 'AC1',
      },
      response,
    );
    expect(mockSearchResources).toHaveBeenCalledWith('AC1', {
      generalSearchTerm: '',
      filters: {},
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
        hrmAccountId: 'AC1',
      },
      response,
    );
    expect(mockSearchResources).toHaveBeenCalledWith('AC1', {
      generalSearchTerm: '',
      filters: {},
      pagination: { limit: 20, start: 0 },
    });
    expect(response.json).toHaveBeenCalledWith(modelResult);
  });
});

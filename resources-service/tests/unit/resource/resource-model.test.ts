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

import {
  getByIdList,
  getWhereNameContains,
  ReferrableResource,
} from '../../../src/resource/resource-data-access';
import { searchResources } from '../../../src/resource/resource-model';

jest.mock('../../../src/resource/resource-data-access', () => ({
  getByIdList: jest.fn(),
  getWhereNameContains: jest.fn(),
}));

const mockGetByIdList = getByIdList as jest.Mock<Promise<ReferrableResource[]>>;
const mockGetWhereNameContains = getWhereNameContains as jest.Mock<
  Promise<{ totalCount: number; results: string[] }>
>;

describe('searchResources', () => {
  beforeEach(() => {
    mockGetByIdList.mockReset();
    mockGetWhereNameContains.mockReset();
  });
  test('Name search only specified - finds ids with getWhereNameContains and looks up resources with getByIdList', async () => {
    const resultSet = [
      { id: 'RESOURCE_1', name: 'Resource 1' },
      { id: 'RESOURCE_2', name: 'Resource 2' },
    ];
    mockGetWhereNameContains.mockResolvedValue({
      totalCount: 123,
      results: ['RESOURCE_1', 'RESOURCE_2'],
    });
    mockGetByIdList.mockResolvedValue(resultSet);
    const res = await searchResources('AC_FAKE_ACCOUNT', {
      nameSubstring: 'Res',
      ids: [],
      pagination: { limit: 5, start: 10 },
    });
    expect(res.totalCount).toBe(123);
    expect(res.results).toStrictEqual(resultSet);
    expect(getWhereNameContains).toHaveBeenCalledWith('AC_FAKE_ACCOUNT', 'Res', 10, 5);
    expect(getByIdList).toHaveBeenCalledWith('AC_FAKE_ACCOUNT', ['RESOURCE_1', 'RESOURCE_2']);
  });
  test('Limit over 200 - forces limit to 100', async () => {
    mockGetWhereNameContains.mockResolvedValue({
      totalCount: 123,
      results: ['RESOURCE_1', 'RESOURCE_2'],
    });
    mockGetByIdList.mockResolvedValue([]);
    await searchResources('AC_FAKE_ACCOUNT', {
      nameSubstring: 'Res',
      ids: [],
      pagination: { limit: 500, start: 10 },
    });
    expect(getWhereNameContains).toHaveBeenCalledWith('AC_FAKE_ACCOUNT', 'Res', 10, 200);
  });
  test('Id search only specified - looks up resources with getByIdList', async () => {
    const resultSet = [
      { id: 'RESOURCE_1', name: 'Resource 1' },
      { id: 'RESOURCE_2', name: 'Resource 2' },
    ];
    mockGetByIdList.mockResolvedValue(resultSet);
    const res = await searchResources('AC_FAKE_ACCOUNT', {
      ids: ['RESOURCE_1', 'RESOURCE_2'],
      pagination: { limit: 5, start: 0 },
    });
    expect(res.totalCount).toBe(2);
    expect(res.results).toStrictEqual(resultSet);
    expect(getWhereNameContains).not.toHaveBeenCalled();
    expect(getByIdList).toHaveBeenCalledWith('AC_FAKE_ACCOUNT', ['RESOURCE_1', 'RESOURCE_2']);
  });
  test('Id search only specified with start - skips {start} number of results', async () => {
    const resultSet = [
      { id: 'RESOURCE_3', name: 'Resource 3' },
      { id: 'RESOURCE_1', name: 'Resource 1' },
      { id: 'RESOURCE_2', name: 'Resource 2' },
      { id: 'RESOURCE_4', name: 'Resource 4' },
    ];
    mockGetByIdList.mockResolvedValue(resultSet);
    const res = await searchResources('AC_FAKE_ACCOUNT', {
      ids: ['RESOURCE_3', 'RESOURCE_1', 'RESOURCE_2', 'RESOURCE_4'],
      pagination: { limit: 5, start: 2 },
    });
    expect(res.totalCount).toBe(4);
    expect(res.results).toStrictEqual(resultSet.slice(2));
    expect(getWhereNameContains).not.toHaveBeenCalled();
    expect(getByIdList).toHaveBeenCalledWith('AC_FAKE_ACCOUNT', [
      'RESOURCE_3',
      'RESOURCE_1',
      'RESOURCE_2',
      'RESOURCE_4',
    ]);
  });
  test('Id search where DB returns different order - restores original order', async () => {
    const resultSet = [
      { id: 'RESOURCE_1', name: 'Resource 1' },
      { id: 'RESOURCE_2', name: 'Resource 2' },
      { id: 'RESOURCE_3', name: 'Resource 3' },
      { id: 'RESOURCE_4', name: 'Resource 4' },
    ];
    mockGetByIdList.mockResolvedValue(resultSet);
    const res = await searchResources('AC_FAKE_ACCOUNT', {
      ids: ['RESOURCE_3', 'RESOURCE_1', 'RESOURCE_2', 'RESOURCE_4'],
      pagination: { limit: 5, start: 0 },
    });
    expect(res.totalCount).toBe(4);
    expect(res.results).toStrictEqual([
      { id: 'RESOURCE_3', name: 'Resource 3' },
      { id: 'RESOURCE_1', name: 'Resource 1' },
      { id: 'RESOURCE_2', name: 'Resource 2' },
      { id: 'RESOURCE_4', name: 'Resource 4' },
    ]);
    expect(getWhereNameContains).not.toHaveBeenCalled();
    expect(getByIdList).toHaveBeenCalledWith('AC_FAKE_ACCOUNT', [
      'RESOURCE_3',
      'RESOURCE_1',
      'RESOURCE_2',
      'RESOURCE_4',
    ]);
  });
  test('Id search where DB doesnt find all IDs - returns what it finds, respecting original order', async () => {
    const resultSet = [
      { id: 'RESOURCE_1', name: 'Resource 1' },
      { id: 'RESOURCE_2', name: 'Resource 2' },
      { id: 'RESOURCE_4', name: 'Resource 4' },
    ];
    mockGetByIdList.mockResolvedValue(resultSet);
    const res = await searchResources('AC_FAKE_ACCOUNT', {
      ids: ['RESOURCE_3', 'RESOURCE_1', 'RESOURCE_2', 'RESOURCE_4'],
      pagination: { limit: 5, start: 0 },
    });
    expect(res.totalCount).toBe(3);
    expect(res.results).toStrictEqual([
      { id: 'RESOURCE_1', name: 'Resource 1' },
      { id: 'RESOURCE_2', name: 'Resource 2' },
      { id: 'RESOURCE_4', name: 'Resource 4' },
    ]);
    expect(getWhereNameContains).not.toHaveBeenCalled();
    expect(getByIdList).toHaveBeenCalledWith('AC_FAKE_ACCOUNT', [
      'RESOURCE_3',
      'RESOURCE_1',
      'RESOURCE_2',
      'RESOURCE_4',
    ]);
  });
  test('Id search with duplicates - restores order where each unique ID is first found', async () => {
    const resultSet = [
      { id: 'RESOURCE_1', name: 'Resource 1' },
      { id: 'RESOURCE_2', name: 'Resource 2' },
      { id: 'RESOURCE_3', name: 'Resource 3' },
      { id: 'RESOURCE_4', name: 'Resource 4' },
    ];
    mockGetByIdList.mockResolvedValue(resultSet);
    const res = await searchResources('AC_FAKE_ACCOUNT', {
      ids: [
        'RESOURCE_3',
        'RESOURCE_3',
        'RESOURCE_3',
        'RESOURCE_1',
        'RESOURCE_3',
        'RESOURCE_1',
        'RESOURCE_2',
        'RESOURCE_4',
        'RESOURCE_2',
      ],
      pagination: { limit: 5, start: 0 },
    });
    expect(res.totalCount).toBe(4);
    expect(res.results).toStrictEqual([
      { id: 'RESOURCE_3', name: 'Resource 3' },
      { id: 'RESOURCE_1', name: 'Resource 1' },
      { id: 'RESOURCE_2', name: 'Resource 2' },
      { id: 'RESOURCE_4', name: 'Resource 4' },
    ]);
    expect(getWhereNameContains).not.toHaveBeenCalled();
    expect(getByIdList).toHaveBeenCalledWith('AC_FAKE_ACCOUNT', [
      'RESOURCE_3',
      'RESOURCE_3',
      'RESOURCE_3',
      'RESOURCE_1',
      'RESOURCE_3',
      'RESOURCE_1',
      'RESOURCE_2',
      'RESOURCE_4',
      'RESOURCE_2',
    ]);
  });
  test('Id search where start is past max available results - returns empty array but correct result', async () => {
    const resultSet = [
      { id: 'RESOURCE_1', name: 'Resource 1' },
      { id: 'RESOURCE_2', name: 'Resource 2' },
      { id: 'RESOURCE_3', name: 'Resource 3' },
      { id: 'RESOURCE_4', name: 'Resource 4' },
    ];
    mockGetByIdList.mockResolvedValue(resultSet);
    const res = await searchResources('AC_FAKE_ACCOUNT', {
      ids: ['RESOURCE_3', 'RESOURCE_1', 'RESOURCE_2', 'RESOURCE_4'],
      pagination: { limit: 3, start: 10 },
    });
    expect(res.totalCount).toBe(4);
    expect(res.results).toStrictEqual([]);
    expect(getWhereNameContains).not.toHaveBeenCalled();
    expect(getByIdList).toHaveBeenCalledWith('AC_FAKE_ACCOUNT', [
      'RESOURCE_3',
      'RESOURCE_1',
      'RESOURCE_2',
      'RESOURCE_4',
    ]);
  });
  test('Name and Id search - returns name results first', async () => {
    mockGetWhereNameContains.mockResolvedValue({
      totalCount: 2,
      results: ['RESOURCE_1', 'RESOURCE_4'],
    });

    const resultSet = [
      { id: 'RESOURCE_1', name: 'Resource 1' },
      { id: 'RESOURCE_2', name: 'Resource 2' },
      { id: 'RESOURCE_3', name: 'Resource 3' },
      { id: 'RESOURCE_4', name: 'Resource 4' },
    ];
    mockGetByIdList.mockResolvedValue(resultSet);
    mockGetByIdList.mockResolvedValue(resultSet);
    const res = await searchResources('AC_FAKE_ACCOUNT', {
      nameSubstring: 'Res',
      ids: ['RESOURCE_3', 'RESOURCE_2', 'RESOURCE_4'],
      pagination: { limit: 10, start: 0 },
    });
    expect(res.totalCount).toBe(4);
    expect(res.results).toStrictEqual([
      { id: 'RESOURCE_1', name: 'Resource 1' },
      { id: 'RESOURCE_4', name: 'Resource 4' },
      { id: 'RESOURCE_3', name: 'Resource 3' },
      { id: 'RESOURCE_2', name: 'Resource 2' },
    ]);
    expect(getWhereNameContains).toHaveBeenCalledWith('AC_FAKE_ACCOUNT', 'Res', 0, 10);
    expect(getByIdList).toHaveBeenCalledWith('AC_FAKE_ACCOUNT', [
      'RESOURCE_1',
      'RESOURCE_4',
      'RESOURCE_3',
      'RESOURCE_2',
    ]);
  });
  test('Name and Id search from start greater than zero - calculates correct totalCount including ID list', async () => {
    mockGetWhereNameContains.mockResolvedValue({
      totalCount: 100,
      results: ['RESOURCE_1', 'RESOURCE_4'],
    });

    const resultSet = [
      { id: 'RESOURCE_1', name: 'Resource 1' },
      { id: 'RESOURCE_2', name: 'Resource 2' },
      { id: 'RESOURCE_3', name: 'Resource 3' },
      { id: 'RESOURCE_4', name: 'Resource 4' },
    ];
    mockGetByIdList.mockResolvedValue(resultSet);
    mockGetByIdList.mockResolvedValue(resultSet);
    const res = await searchResources('AC_FAKE_ACCOUNT', {
      nameSubstring: 'Res',
      ids: ['RESOURCE_3', 'RESOURCE_2', 'RESOURCE_4'],
      pagination: { limit: 10, start: 98 },
    });
    expect(res.totalCount).toBe(102);
    expect(res.results).toStrictEqual([
      { id: 'RESOURCE_1', name: 'Resource 1' },
      { id: 'RESOURCE_4', name: 'Resource 4' },
      { id: 'RESOURCE_3', name: 'Resource 3' },
      { id: 'RESOURCE_2', name: 'Resource 2' },
    ]);
    expect(getWhereNameContains).toHaveBeenCalledWith('AC_FAKE_ACCOUNT', 'Res', 98, 10);
    expect(getByIdList).toHaveBeenCalledWith('AC_FAKE_ACCOUNT', [
      'RESOURCE_1',
      'RESOURCE_4',
      'RESOURCE_3',
      'RESOURCE_2',
    ]);
  });
});

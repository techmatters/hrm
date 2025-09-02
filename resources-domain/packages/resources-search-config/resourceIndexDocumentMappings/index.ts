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

import type { ResourceIndexDocumentMappings } from './resourceIndexDocumentMappings';
import khpMappings from './khpMappings';
import uschMappings from './uschMappings';
import { ResourcesSearchConfiguration } from '../searchConfiguration';

export * from './resourceIndexDocumentMappings';

export const getMappingsForAccount = (
  shortCode: string,
): {
  resourceIndexDocumentMappings: ResourceIndexDocumentMappings;
  filterMappings: ResourcesSearchConfiguration['filterMappings'];
} => {
  switch (shortCode.toUpperCase()) {
    case 'E2E':
    case 'CA': {
      return khpMappings;
    }
    case 'AS':
    case 'USCH':
      return uschMappings;
    default: {
      throw new Error(`Mapping not defined for account ${shortCode}`);
    }
  }
};

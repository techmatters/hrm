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

import type { AccountSID } from '@tech-matters/types';
import type { FlatResource } from '@tech-matters/resources-types';
import { createKhpClient, KhpApiResource } from './clients/khp';
import { createNamiClient } from './clients/nami';
import type { NativeResource } from './clients/shared';
import { transformKhpResourceToApiResource } from './khpMappings';
import { fullImportProgress, sequenceImportProgress } from './progress';

// Placeholder mapping until the NAMI resource attributes are mapped.
const transformNamiResource = (
  accountSid: AccountSID,
  resource: NativeResource,
): FlatResource => ({
  accountSid,
  id: String(resource.id),
  name: resource.name || `Deleted resource ${resource.id}`,
  lastUpdated: resource.deleted_at || new Date().toISOString(),
  deletedAt: resource.deleted_at || '',
  stringAttributes: [],
  referenceStringAttributes: [],
  booleanAttributes: [],
  numberAttributes: [],
  dateTimeAttributes: [],
});

const khp = {
  createClient: createKhpClient,
  progress: sequenceImportProgress,
  transform: (accountSid: AccountSID, resource: NativeResource) =>
    transformKhpResourceToApiResource(accountSid, resource as KhpApiResource),
  needsApiKey: true,
  needsProgress: true,
  failOnSendError: false,
};

const integrations: Record<string, typeof khp> = {
  khp,
  nami: {
    createClient: createNamiClient,
    progress: fullImportProgress,
    transform: transformNamiResource,
    needsApiKey: false,
    needsProgress: false,
    failOnSendError: true,
  },
};

export const getIntegration = (name: string) => {
  const integration =
    typeof name === 'string' && Object.prototype.hasOwnProperty.call(integrations, name)
      ? integrations[name]
      : undefined;
  if (!integration) throw new Error(`Unsupported integration: ${name}`);
  return integration;
};

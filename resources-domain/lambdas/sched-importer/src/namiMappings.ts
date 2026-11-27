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
  attributeMapping,
  MappingNode,
  resourceFieldMapping,
  transformExternalResourceToApiResource,
  translatableAttributeMapping,
} from '@tech-matters/resources-mappers';
import type { FlatResource } from '@tech-matters/resources-types';
import type { AccountSID } from '@tech-matters/types';

type NamiTerm = { id: number; name: string; slug: string };
type NamiTermField =
  | 'aselo'
  | 'language'
  | 'source'
  | 'topic'
  | 'mental-health-concern'
  | 'mental-health-diagnosis'
  | 'audience'
  | 'content-type'
  | 'post_tag';

export type NamiApiResource = {
  id: number;
  name: string;
  description: string;
  url: string;
  address: string;
  phone: string;
  chat_link: string;
  email: string;
  additional_info: string;
} & Record<NamiTermField, NamiTerm[]>;

export type NamiDeletedResource = { id: number; deleted_at: string };

const termMapping = (termType: string): { children: MappingNode } => ({
  children: {
    '{termIndex}': translatableAttributeMapping(
      ({ currentValue }) => {
        if (!Number.isSafeInteger(currentValue.id)) {
          throw new Error('Invalid NAMI term ID');
        }
        return `terms/${termType}/${currentValue.id}`;
      },
      {
        value: ({ currentValue }) => currentValue.name,
        info: ({ currentValue }) => currentValue,
      },
    ),
  },
});

const NAMI_MAPPING_NODE: MappingNode = {
  id: resourceFieldMapping('id', ({ currentValue }) => String(currentValue)),
  name: resourceFieldMapping('name'),
  description: translatableAttributeMapping('description', {
    info: ({ currentValue }) => ({ text: currentValue }),
  }),
  url: translatableAttributeMapping('website'),
  address: translatableAttributeMapping('address'),
  phone: attributeMapping('stringAttributes', 'phone'),
  chat_link: attributeMapping('stringAttributes', 'chatLink'),
  email: attributeMapping('stringAttributes', 'email'),
  additional_info: translatableAttributeMapping('additionalInfo'),
  aselo: termMapping('aselo'),
  language: termMapping('language'),
  source: termMapping('source'),
  topic: termMapping('topic'),
  'mental-health-concern': termMapping('mentalHealthConcern'),
  'mental-health-diagnosis': termMapping('mentalHealthDiagnosis'),
  audience: termMapping('audience'),
  'content-type': termMapping('contentType'),
  post_tag: termMapping('postTag'),
  deleted_at: resourceFieldMapping('deletedAt'),
};

export const transformNamiResourceToApiResource = (
  accountSid: AccountSID,
  namiResource: NamiApiResource | NamiDeletedResource,
): FlatResource => {
  const resource = transformExternalResourceToApiResource(
    NAMI_MAPPING_NODE,
    accountSid,
    namiResource,
  );
  resource.name ||= `Deleted resource ${resource.id}`;
  resource.lastUpdated = resource.deletedAt || new Date().toISOString();
  return resource;
};

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
type NamiTaxonomy =
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
} & Record<NamiTaxonomy, NamiTerm[]>;

export type NamiDeletedResource = { id: number; deleted_at: string };

const taxonomyMapping = (taxonomy: NamiTaxonomy): { children: MappingNode } => ({
  children: {
    '{termIndex}': translatableAttributeMapping(
      ({ currentValue }) => {
        if (!Number.isSafeInteger(currentValue.id)) {
          throw new Error('Invalid NAMI taxonomy term ID');
        }
        return `taxonomies/${taxonomy}/${currentValue.id}`;
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
  aselo: taxonomyMapping('aselo'),
  language: taxonomyMapping('language'),
  source: taxonomyMapping('source'),
  topic: taxonomyMapping('topic'),
  'mental-health-concern': taxonomyMapping('mental-health-concern'),
  'mental-health-diagnosis': taxonomyMapping('mental-health-diagnosis'),
  audience: taxonomyMapping('audience'),
  'content-type': taxonomyMapping('content-type'),
  post_tag: taxonomyMapping('post_tag'),
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

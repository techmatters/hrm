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
  NamiApiResource,
  transformNamiResourceToApiResource,
} from '../../src/namiMappings';
import { getIntegration } from '../../src/integrations';

const term = { id: 399, name: 'Crisis support', slug: 'crisis-support' };
const taxonomies = [
  'aselo',
  'language',
  'source',
  'topic',
  'mental-health-concern',
  'mental-health-diagnosis',
  'audience',
  'content-type',
  'post_tag',
] as const;
const resource: NamiApiResource = {
  id: 1812,
  name: 'Example Crisis Line',
  description: '<p>Free, confidential support 24/7.</p>',
  url: 'https://example.org',
  address: 'Example address',
  phone: '800-555-0100',
  chat_link: 'https://example.org/chat',
  email: 'example@example.org',
  additional_info: 'Additional information',
  aselo: [term],
  language: [term],
  source: [term],
  topic: [term, { id: 400, name: 'Another topic', slug: 'another-topic' }],
  'mental-health-concern': [term],
  'mental-health-diagnosis': [term],
  audience: [term],
  'content-type': [term],
  post_tag: [term],
};

test('maps every documented resource field and preserves taxonomy metadata', () => {
  const before = Date.now();
  const mapped = getIntegration('nami').transform('AC000', resource);
  const after = Date.now();
  expect(mapped).toEqual({
    accountSid: 'AC000',
    id: '1812',
    name: 'Example Crisis Line',
    lastUpdated: expect.any(String),
    deletedAt: '',
    stringAttributes: [
      {
        key: 'description',
        value: resource.description,
        language: '',
        info: { text: resource.description },
      },
      ...[
        ['website', resource.url],
        ['address', resource.address],
        ['phone', resource.phone],
        ['chatLink', resource.chat_link],
        ['email', resource.email],
        ['additionalInfo', resource.additional_info],
      ].map(([key, value]) => ({ key, value, language: '', info: null })),
      ...taxonomies.flatMap(taxonomy =>
        resource[taxonomy].map(item => ({
          key: `taxonomies/${taxonomy}/${item.slug}`,
          value: item.name,
          language: '',
          info: item,
        })),
      ),
    ],
    referenceStringAttributes: [],
    booleanAttributes: [],
    numberAttributes: [],
    dateTimeAttributes: [],
  });
  expect(Date.parse(mapped.lastUpdated)).toBeGreaterThanOrEqual(before);
  expect(Date.parse(mapped.lastUpdated)).toBeLessThanOrEqual(after);
});

test('maps empty values and taxonomy arrays without inventing terms', () => {
  const mapped = transformNamiResourceToApiResource('AC000', {
    ...resource,
    description: '',
    url: '',
    address: '',
    phone: '',
    chat_link: '',
    email: '',
    additional_info: '',
    aselo: [],
    language: [],
    source: [],
    topic: [],
    'mental-health-concern': [],
    'mental-health-diagnosis': [],
    audience: [],
    'content-type': [],
    post_tag: [],
  });
  expect(mapped.stringAttributes).toHaveLength(7);
  expect(mapped.stringAttributes.every(attribute => attribute.value === '')).toBe(true);
});

test('maps deletion records without resource attributes', () => {
  expect(
    transformNamiResourceToApiResource('AC000', {
      id: 1796,
      deleted_at: '2026-10-05T12:31:59+00:00',
    }),
  ).toEqual({
    accountSid: 'AC000',
    id: '1796',
    name: 'Deleted resource 1796',
    lastUpdated: '2026-10-05T12:31:59+00:00',
    deletedAt: '2026-10-05T12:31:59+00:00',
    stringAttributes: [],
    referenceStringAttributes: [],
    booleanAttributes: [],
    numberAttributes: [],
    dateTimeAttributes: [],
  });
});

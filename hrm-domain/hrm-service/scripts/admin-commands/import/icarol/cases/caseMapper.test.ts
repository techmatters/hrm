/**
 * Copyright (C) 2021-2026 Technology Matters
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
import type { CaseCandidate } from './caseIdentityResolution';
import { mapCase } from './caseMapper';

const buildCandidate = (overrides: Partial<CaseCandidate> = {}): CaseCandidate => ({
  callerNums: ['100'],
  label: 'Jane Doe',
  contactTaskIds: ['TK_legacy_1', 'TK_legacy_2'],
  distinctPhoneNumbers: ['5551111111', '5552222222'],
  ...overrides,
});

describe('mapCase', () => {
  test('maps label, status, and definitionVersion', () => {
    const result = mapCase(buildCandidate());
    expect(result.label).toEqual('Jane Doe');
    expect(result.status).toEqual('open');
    expect(result.definitionVersion).toEqual('usnc-v1');
  });

  test('sets info.definitionVersion, required by createCase', () => {
    const result = mapCase(buildCandidate());
    expect(result.info).toMatchObject({ definitionVersion: 'usnc-v1' });
  });

  test('includes linkedProfileName and summary in info when present', () => {
    const result = mapCase(
      buildCandidate({ linkedProfileName: 'Janey', summary: 'Long-time caller' }),
    );
    expect(result.info).toMatchObject({
      linkedProfileName: 'Janey',
      summary: 'Long-time caller',
    });
  });

  test('omits linkedProfileName and summary from info when not present', () => {
    const result = mapCase(buildCandidate());
    expect(result.info).not.toHaveProperty('linkedProfileName');
    expect(result.info).not.toHaveProperty('summary');
  });

  test('does not set createdBy or twilioWorkerId, no data-driven value exists for them', () => {
    const result = mapCase(buildCandidate());
    expect(result).not.toHaveProperty('createdBy');
    expect(result).not.toHaveProperty('twilioWorkerId');
  });
});

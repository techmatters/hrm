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

import type { MappingProperty } from '@elastic/elasticsearch/lib/api/types';
import {
  caseMapping,
  casePathToContacts,
  casePathToSections,
  caseSectionMapping,
  contactMapping,
} from './mappings';

export {
  caseMapping,
  contactMapping,
  casePathToContacts,
  casePathToSections,
} from './mappings';

export type MappingToDocument<T extends NonNullable<Record<string, MappingProperty>>> =
  Partial<{
    [k in keyof T]: k extends string
      ? T[k]['type'] extends 'keyword'
        ? string | null
        : T[k]['type'] extends 'text'
        ? string | null
        : T[k]['type'] extends 'integer'
        ? number | null
        : T[k]['type'] extends 'boolean'
        ? boolean | null
        : T[k]['type'] extends 'date'
        ? string | null
        : T[k]['type'] extends 'nested'
        ? T[k] extends {
            properties: Record<string, MappingProperty>;
          }
          ? MappingToDocument<T[k]['properties']>[] | null
          : never
        : never // forbid non-used types to force proper implementation
      : never;
  }>;

export type ContactDocument = MappingToDocument<typeof contactMapping>;
export type CaseSectionDocument = MappingToDocument<typeof caseSectionMapping>;
export type CaseDocument = MappingToDocument<typeof caseMapping>;

export enum DocumentType {
  Contact = 'contact',
  CaseSection = 'caseSection',
  Case = 'case',
}

export type DocumentTypeToDocument = {
  [DocumentType.Contact]: ContactDocument;
  [DocumentType.CaseSection]: CaseSectionDocument;
  [DocumentType.Case]: CaseDocument;
};

export type NestedDocumentTypesRelations = {
  [DocumentType.Contact]: {};
  [DocumentType.CaseSection]: {};
  [DocumentType.Case]: {
    [casePathToContacts]: DocumentType.Contact;
    [casePathToSections]: DocumentType.CaseSection;
  };
};

export const HRM_CONTACTS_INDEX_TYPE = 'hrm-contacts' as const;
export type HrmContactsIndexType = `${string}-${typeof HRM_CONTACTS_INDEX_TYPE}`;
export const isHrmContactsIndex = (s: unknown): s is HrmContactsIndexType =>
  typeof s === 'string' && s.endsWith(HRM_CONTACTS_INDEX_TYPE);

export const HRM_CASES_INDEX_TYPE = 'hrm-cases' as const;
export type HrmCasesIndexType = `${string}-${typeof HRM_CASES_INDEX_TYPE}`;
export const isHrmCasesIndex = (s: unknown): s is HrmCasesIndexType =>
  typeof s === 'string' && s.endsWith(HRM_CASES_INDEX_TYPE);

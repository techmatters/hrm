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

// Properties present in root and nested documents
const commonProperties = {
  accountSid: {
    type: 'keyword',
  },
  createdBy: {
    type: 'keyword',
  },
  updatedBy: {
    type: 'keyword',
  },
  createdAt: {
    type: 'date',
  },
  updatedAt: {
    type: 'date',
  },
  content: {
    type: 'text',
  },
} as const;

// Properties shared by both types of documents, cases and contacts
const rootProperties = {
  id: {
    type: 'keyword',
  },
  twilioWorkerId: {
    type: 'keyword',
  },
  helpline: {
    type: 'keyword',
  },
  ...commonProperties,
} as const;

// Properties specific to contacts
export const contactMapping = {
  ...rootProperties,
  number: {
    type: 'keyword',
  },
  channel: {
    type: 'keyword',
  },
  finalized: {
    type: 'boolean',
  },
  timeOfContact: {
    type: 'date',
  },
  transcript: {
    type: 'text',
  },
  isDataContact: {
    type: 'boolean',
  },
} as const;

export const casePathToContacts = 'contacts' as const;
export const casePathToSections = 'sections' as const;

// Properties specific to case serctions
export const caseSectionMapping = {
  sectionType: {
    type: 'keyword',
  },
  sectionId: {
    type: 'keyword',
  },
  ...commonProperties,
} as const;

// Properties specific to cases
export const caseMapping = {
  ...rootProperties,
  status: {
    type: 'keyword',
  },
  statusUpdatedAt: {
    type: 'date',
  },
  statusUpdatedBy: {
    type: 'keyword',
  },
  previousStatus: {
    type: 'keyword',
  },
  [casePathToSections]: {
    type: 'nested',
    properties: caseSectionMapping,
  },
  [casePathToContacts]: {
    type: 'nested',
    properties: contactMapping,
  },
} as const;

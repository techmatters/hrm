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
    type: 'integer',
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
  sections: {
    type: 'nested',
    properties: {
      sectionType: {
        type: 'keyword',
      },
      sectionId: {
        type: 'keyword',
      },
      ...commonProperties,
    },
  },
  contacts: {
    type: 'nested',
    properties: {
      ...contactMapping,
    },
  },
} as const;

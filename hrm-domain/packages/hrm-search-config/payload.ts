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

import type {
  CaseSection,
  CaseService,
  Contact,
  NotificationOperation,
} from '@tech-matters/hrm-types';
import { AccountSID } from '@tech-matters/types';

type SupportedNotificationOperation = Extract<
  NotificationOperation,
  'update' | 'create' | 'reindex'
>;
export type DeleteContactMessage = {
  entityType: 'contact';
  operation: 'delete';
  id: string;
};

export type IndexContactMessage = {
  entityType: 'contact';
  operation: SupportedNotificationOperation;
  contact: Pick<Contact, 'id'> & Partial<Contact>;
};

export type DeleteCaseMessage = {
  entityType: 'case';
  operation: 'delete';
  id: string;
};

export type IndexCaseMessage = {
  entityType: 'case';
  operation: SupportedNotificationOperation;
  case: Pick<CaseService, 'id'> &
    Partial<CaseService> & { sections?: Record<string, CaseSection[]> };
};

export type IndexMessage = { accountSid: AccountSID } & (
  | IndexContactMessage
  | IndexCaseMessage
);

export type DeleteMessage = { accountSid: AccountSID } & (
  | DeleteContactMessage
  | DeleteCaseMessage
);

export type IndexPayloadContact = IndexContactMessage & {
  transcript: string | null;
};

export type IndexPayloadCase = IndexCaseMessage;

export type IndexPayload = IndexPayloadContact | IndexPayloadCase;

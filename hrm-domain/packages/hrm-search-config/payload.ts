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
  NotificationOperation,
  EntityType,
  EntityNotificationPayload,
} from '@tech-matters/hrm-types';

export type SupportedNotificationOperation = Extract<
  NotificationOperation,
  'update' | 'create' | 'delete' | 'reindex'
>;

export type IndexContactMessage = EntityNotificationPayload[EntityType.Contact] & {
  operation: SupportedNotificationOperation;
};

export type IndexCaseMessage = EntityNotificationPayload[EntityType.Case] & {
  operation: SupportedNotificationOperation;
};

export type IndexMessage = IndexContactMessage | IndexCaseMessage;

export type IndexPayloadContact =
  | (IndexContactMessage & {
      entityType: EntityType.Contact;
      operation: Exclude<SupportedNotificationOperation, 'delete'>;
      transcript: string | null;
    })
  | (IndexContactMessage & {
      entityType: EntityType.Contact;
      operation: Extract<SupportedNotificationOperation, 'delete'>;
    });

export type IndexPayloadCase = IndexCaseMessage;

export type IndexPayload = IndexPayloadContact | IndexPayloadCase;

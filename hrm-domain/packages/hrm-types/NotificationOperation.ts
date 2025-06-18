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
import { HrmAccountId } from '@tech-matters/types';
import { CaseWithLegacySections } from './Case';
import { Contact as ContactType } from './Contact';
import { ProfileWithRelationships } from './Profile';

export type NotificationOperation =
  | 'update'
  | 'create'
  | 'delete'
  | 'reindex'
  | 'republish'
  | 'reexport';

type DeleteNotificationPayload = {
  accountSid: HrmAccountId;
  operation: Extract<NotificationOperation, 'delete'>;
  id: string;
};

type UpsertCaseNotificationPayload = {
  accountSid: HrmAccountId;
  operation: Extract<
    NotificationOperation,
    'update' | 'create' | 'reindex' | 'republish' | 'reexport'
  >;
  case: CaseWithLegacySections;
};

type UpsertContactNotificationPayload = {
  accountSid: HrmAccountId;
  operation: Extract<
    NotificationOperation,
    'update' | 'create' | 'reindex' | 'republish' | 'reexport'
  >;
  contact: ContactType;
};

type UpsertProfileNotificationPayload = {
  accountSid: HrmAccountId;
  operation: Extract<
    NotificationOperation,
    'update' | 'create' | 'reindex' | 'republish' | 'reexport'
  >;
  profile: ProfileWithRelationships;
};

export enum EntityType {
  Contact = 'contact',
  Case = 'case',
  Profile = 'profile',
}

export type EntityByEntityType = {
  [EntityType.Contact]: ContactType;
  [EntityType.Case]: CaseWithLegacySections;
  [EntityType.Profile]: ProfileWithRelationships;
};

type NotificationPayloadByEntityType = {
  [EntityType.Contact]: UpsertContactNotificationPayload | DeleteNotificationPayload;
  [EntityType.Case]: UpsertCaseNotificationPayload | DeleteNotificationPayload;
  [EntityType.Profile]: UpsertProfileNotificationPayload | DeleteNotificationPayload;
};

type GenerateEntityNotificationPayload<ET extends EntityType> = {
  entityType: ET;
} & NotificationPayloadByEntityType[ET];

export type EntityNotificationPayload = {
  [EntityType.Contact]: GenerateEntityNotificationPayload<EntityType.Contact>;
  [EntityType.Case]: GenerateEntityNotificationPayload<EntityType.Case>;
  [EntityType.Profile]: GenerateEntityNotificationPayload<EntityType.Profile>;
};

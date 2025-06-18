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
import parseISO from 'date-fns/parseISO';

import {
  NotificationOperation,
  EntityNotificationPayload,
  EntityType,
  EntityByEntityType,
} from '@tech-matters/hrm-types';

type SupportedNotificationOperation = Extract<
  NotificationOperation,
  'update' | 'create' | 'reindex'
>;

export type SupportedNotification = EntityNotificationPayload[EntityType] & {
  operation: SupportedNotificationOperation;
};

type NormalisedNotificationPayload =
  | {
      payload: EntityByEntityType[EntityType.Contact];
      timestamp: Date;
      entityType: EntityType.Contact;
    }
  | {
      payload: EntityByEntityType[EntityType.Case];
      timestamp: Date;
      entityType: EntityType.Case;
    }
  | {
      payload: EntityByEntityType[EntityType.Profile];
      timestamp: Date;
      entityType: EntityType.Profile;
    }
  | {
      payload: null;
      timestamp: Date;
      entityType: 'invalid';
    };

export const getNormalisedNotificationPayload = (
  notification: SupportedNotification,
): NormalisedNotificationPayload => {
  switch (notification.entityType) {
    case EntityType.Contact: {
      return {
        entityType: EntityType.Contact,
        timestamp: parseISO(
          notification.contact.updatedAt ?? notification.contact.createdAt,
        ),
        payload: notification.contact,
      };
    }
    case EntityType.Case: {
      return {
        entityType: EntityType.Case,
        timestamp: parseISO(notification.case.updatedAt ?? notification.case.createdAt),
        payload: notification.case,
      };
    }
    case EntityType.Profile: {
      return {
        entityType: EntityType.Profile,
        timestamp: parseISO(
          notification.profile.updatedAt ?? notification.profile.createdAt,
        ),
        payload: notification.profile,
      };
    }
    default: {
      return {
        timestamp: new Date(NaN),
        entityType: 'invalid',
        payload: null,
      };
    }
  }
};

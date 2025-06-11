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
import { HrmAccountId } from '@tech-matters/types';

import { Contact, CaseService, ProfileWithRelationships } from '@tech-matters/hrm-types';

type EntityNotificationHeaders = {
  accountSid: HrmAccountId;
  operation: 'update' | 'create' | 'reexport';
};
type ContactNotification = EntityNotificationHeaders & {
  contact: Contact;
};
type CaseNotification = EntityNotificationHeaders & {
  case: CaseService;
};
type ProfileNotification = EntityNotificationHeaders & {
  profile: ProfileWithRelationships;
};
export type EntityNotification =
  | ContactNotification
  | CaseNotification
  | ProfileNotification;
const isContactNotification = (
  notification: EntityNotification,
): notification is ContactNotification =>
  Boolean((notification as ContactNotification).contact);
const isCaseNotification = (
  notification: EntityNotification,
): notification is CaseNotification => Boolean((notification as CaseNotification).case);
const isProfileNotification = (
  notification: EntityNotification,
): notification is ProfileNotification =>
  Boolean((notification as ProfileNotification).profile);

type NormalisedNotificationPayload = {
  payload: Contact | ProfileWithRelationships | CaseService | null;
  timestamp: Date;
  entityType: 'contact' | 'case' | 'profile' | 'invalid';
};

export const getNormalisedNotificationPayload = (
  notification: EntityNotification,
): NormalisedNotificationPayload => {
  if (isContactNotification(notification)) {
    return {
      entityType: 'contact',
      timestamp: parseISO(
        notification.contact.updatedAt ?? notification.contact.createdAt,
      ),
      payload: notification.contact,
    };
  }
  if (isCaseNotification(notification)) {
    return {
      entityType: 'case',
      timestamp: parseISO(notification.case.updatedAt ?? notification.case.createdAt),
      payload: notification.case,
    };
  }
  if (isProfileNotification(notification)) {
    return {
      entityType: 'profile',
      timestamp: parseISO(
        notification.profile.updatedAt ?? notification.profile.createdAt,
      ),
      payload: notification.profile,
    };
  }
  return {
    timestamp: new Date(NaN),
    entityType: 'invalid',
    payload: null,
  };
};

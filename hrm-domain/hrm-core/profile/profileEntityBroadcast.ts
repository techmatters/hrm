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

import { ProfileWithRelationships } from '@tech-matters/hrm-types';
import { publishEntityChangeNotification } from '../notifications/entityChangeNotify';
import { getProfileById } from './profileDataAccess';

type NotificationOperation = 'create' | 'update';

const doProfileChangeNotification =
  (operation: NotificationOperation) =>
  async ({
    accountSid,
    profileOrId,
  }: {
    accountSid: ProfileWithRelationships['accountSid'];
    profileOrId: ProfileWithRelationships | ProfileWithRelationships['id'];
  }) => {
    try {
      const profile =
        typeof profileOrId === 'object'
          ? profileOrId
          : await getProfileById()(accountSid, profileOrId, true);
      if (profile) {
        console.debug('Broadcasting profile', JSON.stringify(profile, null, 2));
        await publishEntityChangeNotification(accountSid, 'profile', profile, operation);
      } else {
        console.error(
          `Profile ${profileOrId} (${accountSid}) not found to broadcast despite successfully updating data on it.`,
        );
      }
    } catch (err) {
      console.error(
        `Error trying to broadcast profile: accountSid ${accountSid} profile ${
          typeof profileOrId === 'object' ? profileOrId.id : profileOrId
        }`,
        err,
      );
    }
  };

export const notifyCreateProfile = doProfileChangeNotification('create');
export const notifyUpdateProfile = doProfileChangeNotification('update');

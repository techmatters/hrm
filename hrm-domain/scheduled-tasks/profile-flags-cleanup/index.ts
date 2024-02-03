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
import { isErr } from '@tech-matters/types';
import * as profileApi from './dataAccess';

export const cleanupProfileFlags = async (): Promise<void> => {
  try {
    console.info(`[scheduled-task:profile-flags-cleanup]: Starting automatic cleanup...`);

    const result = await profileApi.cleanupProfileFlags();

    if (isErr(result)) {
      console.error(
        `[scheduled-task:profile-flags-cleanup]: Error during cleanup: ${result.error}, ${result.message}`,
      );
      return;
    }

    console.info(
      `[scheduled-task:profile-flags-cleanup]: Removed ${result.data.count} profiles-to-profile-flags associations`,
    );
  } catch (err) {
    console.error(`[scheduled-task:profile-flags-cleanup]: Error during cleanup: ${err}`);
  }
};

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
export const enableCleanupJobs = /^true$/i.test(process.env.ENABLE_CLEANUP_JOBS);
export const enableProfileFlagsCleanup = /^true$/i.test(
  process.env.ENABLE_PROFILE_FLAGS_CLEANUP,
);
export const enablePublishHrmSearchIndex = /^true$/i.test(
  process.env.ENABLE_PUBLISH_HRM_SEARCH_INDEX,
);
export const enableSnsHrmSearchIndex = /^true$/i.test(
  process.env.ENABLE_SNS_HRM_SEARCH_INDEX,
);
export const enableDbUserPerAccount = /^true$/i.test(
  process.env.ENABLE_DB_USER_PER_ACCOUNT,
);

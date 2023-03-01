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

import { ContactJob } from '../../src/contact-job/contact-job-data-access';
import { ContactJobType } from '@tech-matters/hrm-types/ContactJob';

export const getContactJobMock = (overrides: Partial<ContactJob> = {}): ContactJob => ({
  jobType: ContactJobType.RETRIEVE_CONTACT_TRANSCRIPT,
  jobId: 1,
  accountSid: 'accountSid',
  attemptNumber: 1,
  contactId: 123,
  taskId: 'taskId',
  twilioWorkerId: 'twilioWorkerId',
  serviceSid: 'serviceSid',
  channelSid: 'channelSid',
  filePath: 'filePath',
  ...overrides,
});

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

import { pgp } from '../../dbConnection';
import { NewCSAMReport } from '../csamReportDataAccess';
import { HrmAccountId } from '@tech-matters/types';

export const insertCSAMReportSql = (
  report: NewCSAMReport & { accountSid: HrmAccountId; createdAt: Date; updatedAt: Date },
) => `
  ${pgp.helpers.insert(
    report,
    [
      'accountSid',
      'createdAt',
      'updatedAt',
      'twilioWorkerId',
      'csamReportId',
      'contactId',
      'reportType',
      'acknowledged',
    ],
    'CSAMReports',
  )}
  RETURNING *
`;

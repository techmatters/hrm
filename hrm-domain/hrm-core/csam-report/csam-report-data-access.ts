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

import { db } from '../connection-pool';
import { insertCSAMReportSql } from './sql/csam-report-insert-sql';
import {
  selectSingleCsamReportByIdSql,
  selectCsamReportsByContactIdSql,
} from './sql/csam-report-get-sql';
import { updateAcknowledgedByCsamReportIdSql } from './sql/csam-report-update-sql';

export type NewCSAMReport = {
  reportType: 'counsellor-generated' | 'self-generated';
  acknowledged: boolean;
  twilioWorkerId?: string;
  csamReportId?: string;
  contactId?: number;
};

export type CSAMReport = NewCSAMReport & {
  id: number;
  accountSid: string;
  createdAt: Date;
  updatedAt: Date;
};

export const create = async (newCsamReport: NewCSAMReport, accountSid: string) => {
  const now = new Date();
  return db.task(async connection => {
    const statement = insertCSAMReportSql({
      ...newCsamReport,
      updatedAt: now,
      createdAt: now,
      accountSid,
    });

    return connection.one<CSAMReport>(statement);
  });
};

export const getById = async (reportId: number, accountSid: string) =>
  db.task(async connection =>
    connection.oneOrNone<CSAMReport>(selectSingleCsamReportByIdSql, {
      accountSid,
      reportId,
    }),
  );

export const getByContactId = async (contactId: number, accountSid: string) =>
  db.task(async connection =>
    connection.manyOrNone<CSAMReport>(selectCsamReportsByContactIdSql, {
      contactId,
      accountSid,
    }),
  );

export const updateAcknowledgedByCsamReportId =
  (acknowledged: boolean) => async (reportId: number, accountSid: string) =>
    db.task(async connection =>
      connection.oneOrNone<CSAMReport>(updateAcknowledgedByCsamReportIdSql, {
        reportId,
        accountSid,
        acknowledged,
      }),
    );

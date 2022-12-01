import { db } from '../connection-pool';
import { insertCSAMReportSql } from './sql/csam-report-insert-sql';
import {
  selectSingleCsamReportByIdSql,
  selectCsamReportsByContactIdSql,
} from './sql/csam-report-get-sql';
import { updateContactIdByCsamReportIdsSql, updateAcknowledgedByCsamReportIdSql } from './sql/csam-report-update-sql';
// eslint-disable-next-line prettier/prettier
import type { ITask } from 'pg-promise';

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

export const updateContactIdByCsamReportIds = (tx: ITask<{}>) => async (
  contactId: number,
  reportIds: CSAMReport['id'][],
  accountSid: string,
) => {
  return tx.manyOrNone<CSAMReport>(updateContactIdByCsamReportIdsSql, {
      contactId,
      reportIds,
      accountSid,
    });
};

export const updateAcknowledgedByCsamReportId  = (acknowledged: boolean) => async (reportId: number, accountSid: string) =>
  db.task(async connection =>
    connection.oneOrNone<CSAMReport>(updateAcknowledgedByCsamReportIdSql, {
      reportId,
      accountSid,
      acknowledged,
    }),
  );

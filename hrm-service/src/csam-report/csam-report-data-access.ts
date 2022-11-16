import { db } from '../connection-pool';
import { insertCSAMReportSql, NewCSAMReportRecord } from './sql/csam-report-insert-sql';
import {
  // selectCsamReportsByIdsSql,
  selectSingleCsamReportByIdSql,
} from './sql/csam-report-get-sql';
import { updateContactIdByCsamReportIdsSql } from './sql/csam-report-update-sql';

export type CSAMReportRecord = NewCSAMReportRecord & {
  id: number;
};

export type CreateCSAMReport = Omit<NewCSAMReportRecord, 'accountSid'>;

export const create = async (body: CreateCSAMReport, accountSid: string) => {
  return db.task(async connection => {
    const statement = insertCSAMReportSql({
      ...body,
      accountSid,
    });

    return connection.one<CSAMReportRecord>(statement);
  });
};

export const getById = async (csamReportId: number, accountSid: string) =>
  db.task(async connection =>
    connection.oneOrNone<CSAMReportRecord>(selectSingleCsamReportByIdSql, {
      accountSid,
      csamReportId,
    }),
  );

export const updateContactIdByCsamReportIds = async (
  contactId: number,
  csamReportIds: CSAMReportRecord['id'][],
  accountSid: string,
) =>
  db.task(async connection =>
    connection.manyOrNone<CSAMReportRecord>(updateContactIdByCsamReportIdsSql, {
      contactId,
      csamReportIds,
      accountSid,
    }),
  );

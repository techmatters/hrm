import { db } from '../connection-pool';
import { insertCSAMReportSql, NewCSAMReportRecord } from './sql/csam-report-insert-sql';
import {
  selectSingleCsamReportByIdSql,
  selectCsamReportsByContactIdSql,
} from './sql/csam-report-get-sql';
import { updateContactIdByCsamReportIdsSql, updateAcknowledgedByCsamReportIdSql } from './sql/csam-report-update-sql';
// eslint-disable-next-line prettier/prettier
import type { ITask } from 'pg-promise';

export type CSAMReportRecord = NewCSAMReportRecord & {
  id: number;
};

export type CreateCSAMReportRecord = Omit<NewCSAMReportRecord, 'accountSid'>;

export const create = async (body: CreateCSAMReportRecord, accountSid: string) => {
  return db.task(async connection => {
    const statement = insertCSAMReportSql({
      ...body,
      accountSid,
    });

    return connection.one<CSAMReportRecord>(statement);
  });
};

export const getById = async (reportId: number, accountSid: string) =>
  db.task(async connection =>
    connection.oneOrNone<CSAMReportRecord>(selectSingleCsamReportByIdSql, {
      accountSid,
      reportId,
    }),
  );

export const getByContactId = async (contactId: number, accountSid: string) =>
  db.task(async connection =>
    connection.manyOrNone<CSAMReportRecord>(selectCsamReportsByContactIdSql, {
      contactId,
      accountSid,
    }),
  );

export const updateContactIdByCsamReportIds = (tx: ITask<{}>) => async (
  contactId: number,
  reportIds: CSAMReportRecord['id'][],
  accountSid: string,
) => {
  return tx.manyOrNone<CSAMReportRecord>(updateContactIdByCsamReportIdsSql, {
      contactId,
      reportIds,
      accountSid,
    });
};

export const updateAcknowledgedByCsamReportId  = (acknowledged: boolean) => async (reportId: number, accountSid: string) =>
  db.task(async connection =>
    connection.oneOrNone<CSAMReportRecord>(updateAcknowledgedByCsamReportIdSql, {
      reportId,
      accountSid,
      acknowledged,
    }),
  );

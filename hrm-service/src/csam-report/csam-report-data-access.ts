import { db } from '../connection-pool';
import { insertCSAMReportSql, NewCSAMReportRecord } from './sql/csam-report-insert-sql';
import {
  selectSingleCsamReportByIdSql,
  selectCsamReportsByContactIdSql,
} from './sql/csam-report-get-sql';
import { updateContactIdByCsamReportIdsSql } from './sql/csam-report-update-sql';
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

export const getById = async (csamReportId: number, accountSid: string) =>
  db.task(async connection =>
    connection.oneOrNone<CSAMReportRecord>(selectSingleCsamReportByIdSql, {
      accountSid,
      csamReportId,
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
  csamReportIds: CSAMReportRecord['id'][],
  accountSid: string,
) => {
  return tx.manyOrNone<CSAMReportRecord>(updateContactIdByCsamReportIdsSql, {
      contactId,
      csamReportIds,
      accountSid,
    });
};

import pool from './connection-pool';
import { sql } from 'slonik';

export const create = async (body, accountSid, workerSid) => {
  const caseRecord = {
    info: body.info,
    helpline: body.helpline,
    status: body.status || 'open',
    twilioWorkerId: body.twilioWorkerId,
    createdBy: workerSid,
    connectedContacts: [],
    accountSid: accountSid || '',
  };
  await pool.connect(connection => {
    connection.query(sql`INSERT INTO Cases (${sql.join(Object.keys(caseRecord), sql`, `)}) VALUES (Object.values(caseRecord), sql`, `)`)
  })
  const options = {
    include: {
      association: 'connectedContacts',
      include: { association: 'csamReports' },
    },
    context: { workerSid },
  };

  const createdCase = await Case.create(caseRecord, options);
  return createdCase;
};
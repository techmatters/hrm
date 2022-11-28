import env from 'dotenv';

env.config();

export default {
  username: process.env.RDS_USERNAME || 'hrm',
  password: process.env.RDS_PASSWORD || null,
  database: process.env.RDS_DBNAME || 'hrmdb',
  host: process.env.RDS_HOSTNAME || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  dialect: 'postgres',
};

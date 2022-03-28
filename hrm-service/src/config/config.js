require('dotenv').config();

const config = {
  username: process.env.RDS_USERNAME || 'hrm',
  password: process.env.RDS_PASSWORD || null,
  database: process.env.RDS_DBNAME || 'hrmdb',
  host: process.env.RDS_HOSTNAME || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  dialect: 'postgres',
};

module.exports = {
  default: config,
  development: config,
  staging: config,
  production: config,
};

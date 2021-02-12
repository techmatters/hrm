require('dotenv').config();

module.exports = {
  development: {
    username: process.env.RDS_USERNAME || 'hrm',
    password: process.env.RDS_PASSWORD || 'nob1974',
    database: process.env.RDS_DBNAME || 'hrmdb',
    host: process.env.RDS_HOSTNAME || 'localhost',
    dialect: 'postgres',
  },
  staging: {
    username: process.env.RDS_USERNAME,
    password: process.env.RDS_PASSWORD,
    database: process.env.RDS_DBNAME,
    host: process.env.RDS_HOSTNAME,
    dialect: 'postgres',
  },
  production: {
    username: process.env.RDS_USERNAME,
    password: process.env.RDS_PASSWORD,
    database: process.env.RDS_DBNAME,
    host: process.env.RDS_HOSTNAME,
    dialect: 'postgres',
  },
};

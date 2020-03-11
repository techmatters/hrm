require('dotenv').config();

module.exports = {
  development: {
    username: 'hrm',
    password: null,
    database: 'hrmdb',
    host: 'localhost',
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

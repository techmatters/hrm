import env from 'dotenv';

env.config();

export default {
  username: process.env.RESOURCES_USERNAME || 'resources',
  password: process.env.RESOURCES_PASSWORD || '',
  database: process.env.RDS_DBNAME || 'hrmdb',
  host: process.env.RDS_HOSTNAME || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  dialect: 'postgres',
};

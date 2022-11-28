import pgPromise from 'pg-promise';
import config from './config/db';

export const pgp = pgPromise({});

export const db = pgp(
  `postgres://${encodeURIComponent(config.username)}:${encodeURIComponent(config.password)}@${
    config.host
  }:${config.port}/${encodeURIComponent(config.database)}?&application_name=hrm-service`,
);

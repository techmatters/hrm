import pgPromise from 'pg-promise';
import configSet from './config/config';

export const pgp = pgPromise({});

const config = configSet.default;
export const db = pgp(
  `postgres://${encodeURIComponent(config.username)}:${encodeURIComponent(config.password)}@${
    config.host
  }:${config.port}/${encodeURIComponent(config.database)}?&application_name=hrm-service`,
);

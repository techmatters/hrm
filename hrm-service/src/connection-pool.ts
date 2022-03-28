import pgPromise from 'pg-promise';
import configSet from './config/config'

export const pgp = pgPromise({

})

const config = configSet.default
export const db = pgp(`postgres://${config.username}:${config.password}@${config.host}:${config.port}/${config.database}`);
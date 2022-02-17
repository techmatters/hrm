import pgPromise from 'pg-promise';
import configSet from '../config/config'

const pgp = pgPromise({

})

const config = configSet.development
const db = pgp(`postgres://${config.username}:${config.password}@${config.host}:${config.port}/${config.database}`);

export default db;
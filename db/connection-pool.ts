import { createPool } from 'slonik'
import configSet from '../config/config'

const config = configSet.development
const pool = createPool(`postgres://${config.username}:${config.password}@${config.host}:${config.port}/${config.database}`);

export default pool;
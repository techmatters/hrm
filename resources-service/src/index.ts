import { db } from './connection-pool';

export const stub = async () => db.task(async t => t.one('SELECT 1;'));

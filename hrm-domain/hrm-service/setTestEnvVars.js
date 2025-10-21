/**
 * Copyright (C) 2021-2023 Technology Matters
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see https://www.gnu.org/licenses/.
 */

process.env.PERMISSIONS_CONFIG_LOCAL_OVERRIDE = JSON.stringify({
  ACbr: 'br',
  ACca: 'ca',
  ACcl: 'cl',
  ACco: 'co',
  ACet: 'et',
  AChu: 'hu',
  ACin: 'in',
  ACjm: 'jm',
  ACmt: 'mt',
  ACmw: 'mw',
  ACnz: 'nz',
  ACph: 'ph',
  ACsg: 'sg',
  ACth: 'th',
  ACtz: 'tz',
  ACukmh: 'ukmh',
  ACusch: 'usch',
  ACuscr: 'uscr',
  ACusvc: 'usvc',
  ACza: 'za',
  ACzm: 'zm',
  ACzw: 'zw',
  ACopen: 'open',
  ACclosed: 'closed',
  ACdemo: 'demo',
  ACdev: 'dev',
  ACe2e: 'e2e',
  ACeumc: 'eumc',
  notConfigured: '',
  notExistsInRulesMap: 'notExistsInRulesMap',
});

process.env.STATIC_KEY_ACCOUNT_SID = 'BBC';

process.env.INCLUDE_ERROR_IN_RESPONSE = 'true';

process.env.ENABLE_PUBLISH_HRM_SEARCH_INDEX = 'true';
process.env.ENABLE_CLEANUP_JOBS = 'true';
process.env.ENABLE_DB_USER_PER_ACCOUNT = 'true';
process.env.AWS_REGION = 'xx-fake-1';
process.env.AWS_ACCESS_KEY_ID = 'mock-access-key';
process.env.AWS_SECRET_ACCESS_KEY = 'mock-secret-key';
process.env.LOCAL_SQS_PORT = '3010';

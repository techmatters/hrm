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

process.env.AWS_REGION = 'xx-fake-1';
process.env.AWS_ACCESS_KEY_ID = 'mock-access-key';
process.env.AWS_SECRET_ACCESS_KEY = 'mock-secret';
process.env.SSM_ENDPOINT = 'http://mock-ssm/';
process.env.HRM_DATABASE_PORT = process.env.HRM_DATABASE_PORT ?? '5432';

process.env.ACCOUNT_SID = 'ACservicetest';
process.env.INTERNAL_HRM_URL = 'http://localhost:3031';
process.env.BEACON_BASE_URL = 'http://mock-beacon/';
process.env.BEACON_API_KEY = 'mock-beacon-key';

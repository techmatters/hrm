"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = exports.builder = exports.describe = exports.command = void 0;
const renotify_1 = require("../renotify");
exports.command = 'hrm';
exports.describe = 'Republish contacts (TBD cases) to the data lake based on date range';
exports.builder = {
    c: {
        alias: 'contacts',
        describe: 'republish contacts',
        type: 'boolean',
        default: false,
    },
    s: {
        alias: 'cases',
        describe: 'republish cases',
        type: 'boolean',
        default: false,
    },
    e: {
        alias: 'environment',
        describe: 'environment (e.g. development, staging, production)',
        demandOption: true,
        type: 'string',
    },
    r: {
        alias: 'region',
        describe: 'region (e.g. us-east-1)',
        demandOption: true,
        type: 'string',
    },
    a: {
        alias: 'accounts',
        describe: 'list of accounts short codes (e.g. -a=AS ZA)',
        demandOption: true,
        type: 'array',
    },
    f: {
        alias: 'dateFrom',
        describe: 'start date (e.g. 2024-01-01)',
        demandOption: true,
        type: 'string',
    },
    t: {
        alias: 'dateTo',
        describe: 'end date (e.g. 2024-12-31)',
        demandOption: true,
        type: 'string',
    },
};
const handler = async ({ region, environment, accounts, dateFrom, dateTo, contacts, cases, }) => {
    console.info('Republishing entities');
    const allEntities = !contacts && !cases;
    if (allEntities) {
        console.info('No entity type specified so re-publishing all');
    }
    try {
        await (0, renotify_1.renotify)({
            accounts,
            dateFrom,
            dateTo,
            environment,
            operation: 'republish',
            cases: cases || allEntities,
            contacts: contacts || allEntities,
            profiles: false, // not implemented
            region,
        });
    }
    catch (err) {
        console.error(err);
    }
};
exports.handler = handler;

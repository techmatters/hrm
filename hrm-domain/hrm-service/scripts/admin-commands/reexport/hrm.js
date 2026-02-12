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
exports.describe = 'Reexport contacts, cases and profiles to the configured exports S3 bucket for the specified account.';
exports.builder = {
    c: {
        alias: 'contacts',
        describe: 'reexport contacts',
        type: 'boolean',
        default: false,
    },
    s: {
        alias: 'cases',
        describe: 'reexport cases',
        type: 'boolean',
        default: false,
    },
    p: {
        alias: 'profiles',
        describe: 'reexport profiles',
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
        type: 'string',
    },
    t: {
        alias: 'dateTo',
        describe: 'end date (e.g. 2024-12-31)',
        type: 'string',
    },
};
const handler = async ({ region, environment, accounts, dateFrom, dateTo, contacts, cases, profiles, }) => {
    // If no entity types are set, assume we want to renotify them all
    console.info('Reexporting entities');
    const allEntities = !contacts && !profiles && !cases;
    if (allEntities) {
        console.info('No entity type specified so re-exporting all');
    }
    try {
        await (0, renotify_1.renotify)({
            accounts,
            dateFrom,
            dateTo,
            environment,
            operation: 'reexport',
            cases: cases || allEntities,
            contacts: contacts || allEntities,
            profiles: profiles || allEntities,
            region,
        });
    }
    catch (err) {
        console.error(err);
    }
};
exports.handler = handler;

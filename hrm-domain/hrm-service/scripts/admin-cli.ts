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

// eslint-disable-next-line import/no-extraneous-dependencies
import yargs from 'yargs';

// eslint-disable-next-line import/no-extraneous-dependencies
// import { fetch, Response } from 'undici';
// import { AccountSID } from '@tech-matters/types';
// import { getHRMInternalEndpointAccess } from '@tech-matters/service-discovery';

// const staticKeyPattern = /^STATIC_KEY_ADMIN_HRM=(?<key>.*)$/im;

// const main = async () => {
//   const argv = yargs
//     .usage('Usage: $0 <command> [options]')
//     .help('h')
//     .alias('h', 'help').argv;

//   const {
//     e: environment,
//     r: regionParam,
//     a: accountSid,
//     v: verbose,
//   } = yargs(process.argv.slice(2)).options({
//     e: {
//       alias: 'environment',
//       describe: 'The target environment, defaults to development',
//       type: 'string',
//       default: 'development',
//     },
//     r: {
//       alias: 'region',
//       describe:
//         'The region you are targeting. If none provided, will use process.env.AWS_REGION',
//       type: 'string',
//     },
//     a: {
//       alias: 'accountSid',
//       describe: 'The target account sid under which the admin endpoints will be executed',
//       type: 'string',
//     },
//     v: {
//       alias: 'verbose',
//       describe: '',
//       type: 'boolean',
//       default: false,
//     },
//   });

//   const region = regionParam || process.env.AWS_REGION;
//   if (!region) {
//     throw new Error(`region parameter not provided nor set in .env`);
//   }
// };

const main = () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  yargs
    .commandDir('admin-commands', {
      exclude: /^(index|_)/, // Exclude files starting with 'index' or '_'
      extensions: ['ts'],
    })
    .scriptName('admin-cli')
    .demandCommand(1, 'Please provide a valid command')
    .version(false)
    .help().argv;
};

main();

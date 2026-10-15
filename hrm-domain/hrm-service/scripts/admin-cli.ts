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
import { hideBin } from 'yargs/helpers';

// yargs parses single dash multi-letter flags as grouped short flags (e.g. -ea as -e -a),
// so rewrite the ones we support to their double dash form
const MULTI_LETTER_SHORT_FLAGS = ['ea'];
const normaliseArgs = (args: string[]) =>
  args.map(arg =>
    MULTI_LETTER_SHORT_FLAGS.some(
      flag => arg === `-${flag}` || arg.startsWith(`-${flag}=`),
    )
      ? `-${arg}`
      : arg,
  );

const main = () => {
  console.info('Admin CLI');
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  yargs(normaliseArgs(hideBin(process.argv)))
    .commandDir('admin-commands', {
      exclude: /^(index|_)/, // Exclude files starting with 'index' or '_'
      extensions: ['ts'],
    })
    .scriptName('admin-cli')
    .demandCommand(1, 'Please provide a valid command')
    .version(false)
    .wrap(120)
    .help().argv;
};

main();

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

import { pullData } from '../data-pull-task/khp-data-pull-task';

/**
 * Returns an object with the arguments passed to the script.
 *
 * Example:
 * > npm run start:khp-data-pull -- --start-date=2023-05-01 --end-date=2023-05-30
 *
 * returns:
 * { start-date: '2023-05-01', end-date: '2023-05-30' }
 */
// Question: Should use a lib for this?
const getNamedArgs = () => {
  const args = process.argv.slice(2);
  return args.reduce((acc, currentArg) => {
    if (!currentArg.startsWith('--') || !currentArg.includes('=')) return acc;

    const indexOfEqual = currentArg.indexOf('=');
    const name = currentArg.substring(2, indexOfEqual);
    const value = currentArg.substring(indexOfEqual + 1);

    return { ...acc, [name]: value };
  }, {});
};

pullData(getNamedArgs());

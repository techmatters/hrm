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

export const command = 'create';
export const describe = 'Create a new profile flag for the given account';
export const builder = {
  a: {
    describe: 'target account SID',
    demandOption: true,
    type: 'string',
  },
};
export const handler = async (argv: { id: any }) => {
  console.log(`Fetching data for profile ID: ${argv.id}`);
  // Simulating an asynchronous operation with setTimeout
  await new Promise(resolve => setTimeout(resolve, 2000));
  console.log('Async operation completed.');
};

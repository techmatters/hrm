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

/**
 * We export our main interface that has a reduced set of methods from ./dist/index.js
 * which is generated from src/index.ts. We want to keep types close to code, so we export
 * the types from this file, and the implementation from ./dist/index.js. This allows us to
 * reduce the default external interface of the package, while still allowing us to use
 * the full interface internally and to export all types.
 **/
export * from './src/client';
export * from './src/createIndex';
export * from './src/deleteIndex';
export * from './src/indexDocument';
export * from './src/updateDocument';
export * from './src/deleteDocument';
export * from './src/executeBulk';
export * from './src/search';
export * from './src/suggest';
export * from './src/config';
export * from './src/config/indexConfiguration';
export * from './src/config/searchConfiguration';

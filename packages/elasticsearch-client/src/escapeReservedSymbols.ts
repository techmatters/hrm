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
const nonEscapableSymbols = ['>', '<'];

const escapableSymbols = [
  '+',
  '-',
  '=',
  '&',
  '|',
  '!',
  '(',
  ')',
  '{',
  '}',
  '[',
  ']',
  '^',
  '"',
  '~',
  '*',
  '?',
  ':',
  '\\',
  '/',
];

const nonEscapableSymbolsRegex = new RegExp(`[${nonEscapableSymbols.join('')}]`, 'g');

const escapableSymbolsRegex = new RegExp(
  `([${escapableSymbols.map(s => `\\${s}`).join('')}])`,
  'g',
);

export const escapeReservedSymbols = (s: string) => {
  const withoutNonEscapable = s.replace(nonEscapableSymbolsRegex, '');

  return withoutNonEscapable.replace(escapableSymbolsRegex, '\\$1');
};

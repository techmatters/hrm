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
 * Takes a table and a list of properties and returns a SQL snippet that
 * can be used in a SELECT statement to select all of the properties from
 * the table.
 *
 * @param {string} table - name of the table
 * @param {string[]} fields - array of field names
 * @returns {string} - SQL snippet
 */
export const fieldListToSql = (table: string, fields: readonly string[]): string =>
  fields.map(prop => `"${table}"."${prop}"`).join(', ');

/**
 * Takes a table, the name of a jsonb field, and a list of properties in dot
 * notation and returns a SQL snippet that can be used in a SELECT statement
 * to return a JSON object with the properties from the jsonb field.
 *
 * @param {string} table - name of the table
 * @param {string} field - name of the jsonb field
 * @param {string[]} properties - array of property names in dot notation
 * @returns {string} - SQL snippet
 */
export const objectNotationToBuildObjectSql = (
  table: string,
  field: string,
  properties: readonly string[],
): string => {
  const result = ['jsonb_build_object('];
  const paths = {};

  properties.forEach(property => {
    const parts = property.split('.');
    let currentPath = paths;

    parts.forEach((part, index) => {
      if (!currentPath[part]) {
        if (index === parts.length - 1) {
          // If we're at the end of the path, add the SQL snippet
          const keyPath = parts
            .slice(0, -1)
            .map(p => `'${p}'`)
            .join('->');
          const valuePath = keyPath
            ? `"${table}"."${field}"->${keyPath}->>'${part}'`
            : `"${table}"."${field}"->>'${part}'`;
          currentPath[part] = valuePath;
        } else {
          // Otherwise, create a new nested path
          currentPath[part] = {};
        }
      }
      currentPath = currentPath[part];
    });
  });

  function buildSql(obj, depth) {
    const indent = '    '.repeat(depth);
    const entries = Object.entries(obj);

    entries.forEach(([key, value], index) => {
      result.push(`${indent}'${key}', `);

      if (typeof value === 'string') {
        result.push(`${value}`);
      } else {
        result.push('jsonb_build_object(');
        buildSql(value, depth + 1);
        result.push(`${indent})`);
      }

      if (index < entries.length - 1) {
        result.push(',\n');
      }
    });
  }

  buildSql(paths, 1);
  result.push('\n)');

  return result.join('');
};

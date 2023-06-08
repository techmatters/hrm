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

import { ParameterizedQuery } from 'pg-promise';

function isJSONValue(token: string, sql: string): boolean {
  // If any of the tokens mark it as JSON, treat it as JSON everywhere
  // We can deal with weird corner cases where as value is JSON somoe of the time and not others anon.
  return sql.indexOf(`$<${token}:json>`) !== -1;
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function flattenParams(
  obj: { [key: string]: any },
  parentKey: string,
  sql: string,
): { [key: string]: any } {
  const flattened: { [key: string]: any } = {};

  Object.keys(obj).forEach(key => {
    const value = obj[key];
    const fullPath = parentKey ? `${parentKey}.${key}` : key;

    if (
      typeof value === 'object' &&
      !Array.isArray(value) &&
      value !== null &&
      !isJSONValue(fullPath, sql)
    ) {
      const nestedParams = flattenParams(value, fullPath, sql);
      Object.keys(nestedParams).forEach(nestedKey => {
        flattened[nestedKey] = nestedParams[nestedKey];
      });
    } else {
      flattened[fullPath] = value;
    }
  });

  return flattened;
}

export function convertToPostgreSQLQuery(
  sql: string,
  params: { [key: string]: any },
  valueCount = 0,
): { query: string; values: any[] } {
  let query = sql;
  const values: any[] = [];
  // Replace named parameters with positional parameters
  Object.keys(params).forEach(key => {
    const paramValue = params[key];
    const tokenRegex = new RegExp(`\\$<${escapeRegExp(key)}(\:[a-z]+)?\\b>`, 'g');
    if (
      typeof paramValue === 'object' &&
      !Array.isArray(paramValue) &&
      paramValue !== null &&
      !isJSONValue(key, sql)
    ) {
      // Handle nested objects recursively
      const nestedParams = flattenParams(paramValue, key, sql);
      const nestedResult = convertToPostgreSQLQuery(
        query,
        nestedParams,
        valueCount + values.length,
      );
      query = nestedResult.query;
      values.push(...nestedResult.values);
    } else if (Array.isArray(paramValue)) {
      let singleValueAdded = false;
      const positions = [];
      const csvValues = [];
      query = query.replace(tokenRegex, (match, formatSpecifier) => {
        switch (formatSpecifier) {
          case ':csv':
            if (csvValues.length === 0) {
              paramValue.forEach((value: any) => {
                csvValues.push(value ?? null);
                positions.push(`$${values.length + csvValues.length + valueCount}`);
              });
              console.debug(`Mapping ${positions.join(', ')} to ${key}, values: ${paramValue}`);
            }
            return positions.join(', ');
          case ':json':
            if (!singleValueAdded) {
              values.push(JSON.stringify(paramValue));
              singleValueAdded = true;
              console.debug(
                `Mapping $${values.length + valueCount} to ${key}, value: ${JSON.stringify(
                  paramValue,
                )}`,
              );
            }
            return `$${values.length + valueCount}`;
          default:
            if (!singleValueAdded) {
              values.push(paramValue);
              singleValueAdded = true;
              console.debug(
                `Mapping $${values.length + valueCount} to ${key}, value: ${paramValue}`,
              );
            }
            return `$${values.length + valueCount}`;
        }
      });
      values.push(...csvValues);
    } else {
      let singleValueAdded = false;
      query = query.replace(tokenRegex, () => {
        if (!singleValueAdded) {
          values.push(paramValue ?? null);
          singleValueAdded = true;
          console.debug(`Mapping $${values.length + valueCount} to ${key}, value: ${paramValue}`);
        }
        return `$${values.length + valueCount}`;
      });
    }
  });
  console.debug('Parameterized query:', query, values);
  return { query, values };
}

export function parameterizedQuery(
  sql: string,
  params: { [key: string]: any },
): ParameterizedQuery {
  const { query, values } = convertToPostgreSQLQuery(sql, params);

  return new ParameterizedQuery({ text: query, values });
}

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
import { fieldListToSql, objectNotationToBuildObjectSql } from './listToSql';

export type JsonProperty = {
  field: string;
  properties: string[];
};

export type ConstantConfig = {
  foreignIdField: string;
  listFields: string[];
  listJsonFieldProperties?: JsonProperty[];
  table: string;
};

export type Constants = ConstantConfig & {
  foreignIdFieldSql: string;
  tableSql: string;
  listFieldsSql: string;
  listJsonFieldPropertiesSql?: string;
};

export const listJsonPropertiesToSql = constantConfig => {
  const selectSqls = constantConfig.listJsonFieldProperties?.map(prop => {
    return `${objectNotationToBuildObjectSql(
      constantConfig.table,
      prop.field,
      prop.properties,
    )} AS "${prop.field}"`;
  });
  return selectSqls?.join(', ');
};

export const initConstants = (constantConfig: ConstantConfig): Constants => {
  return {
    ...constantConfig,
    tableSql: `"${constantConfig.table}"`,
    foreignIdFieldSql: `"${constantConfig.foreignIdField}"`,
    listFieldsSql: fieldListToSql(constantConfig.table, constantConfig.listFields),
    listJsonFieldPropertiesSql: listJsonPropertiesToSql(constantConfig),
  };
};

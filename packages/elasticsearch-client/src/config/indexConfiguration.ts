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

// eslint-disable-next-line prettier/prettier
import type { PropertyName, MappingProperty, IndicesCreateRequest } from '@elastic/elasticsearch/lib/api/types';
import { getCreateIndexParams } from './getCreateIndexParams';
import { CreateIndexConvertedDocument } from './index';

export type IndexConfiguration<T = any> = {
  highBoostGlobalFields: string[];
  mappingFields: {
    [key: string]: {
      type: 'integer' | 'keyword' | 'text';
      hasLanguageFields?: boolean;
      isArrayField?: boolean;
    };
  };
  languageFields: Record<PropertyName, MappingProperty>
  getCreateIndexParams: (indexName: string) => IndicesCreateRequest
  convertToIndexDocument: (sourceEntity: T) => CreateIndexConvertedDocument
};
const stringFieldTypes = ['text', 'keyword'];

export const isMappingField = ({ mappingFields }: Pick<IndexConfiguration, 'mappingFields'>, fieldName: string) =>
  Object.keys(mappingFields).includes(fieldName);
export const isHighBoostGlobalField = ({ highBoostGlobalFields }: Pick<IndexConfiguration, 'highBoostGlobalFields'>, fieldName: string) =>
  highBoostGlobalFields.includes(fieldName);
export const isStringField = (fieldType: string): fieldType is 'keyword' | 'text' =>
  stringFieldTypes.includes(fieldType);

type IndexConfigurationOptions<T> = Omit<IndexConfiguration<T>, 'getCreateIndexParams'> & Partial<IndexConfiguration<T>>;

export const newIndexConfiguration = <T>(configuration: IndexConfigurationOptions<T>): IndexConfiguration<T> => ({
  getCreateIndexParams: (index: string) => getCreateIndexParams(configuration, index),
  ...configuration,
});
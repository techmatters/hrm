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
import { FlatResource, ReferrableResourceTranslatableAttribute } from './Resources';

export type InlineAttributeProperty =
  | 'stringAttributes'
  | 'booleanAttributes'
  | 'numberAttributes'
  | 'dateTimeAttributes';

export type AttributeProperty = InlineAttributeProperty | 'referenceStringAttributes';

export type AttributeValue<T extends AttributeProperty> = T extends 'booleanAttributes'
  ? boolean
  : T extends 'numberAttributes'
  ? number
  : string;

export type ImportBatch = {
  toDate: string;
  fromDate: string;
  remaining: number;
};

export type ImportProgress = ImportBatch & {
  lastProcessedDate: string;
  lastProcessedId: string;
};

/**
 * Type that allows reference attributes to be specified by ID rathger than value when importing
 */
export type ReferrableResourceReferenceAttribute = (
  | ReferrableResourceTranslatableAttribute
  | (Omit<ReferrableResourceTranslatableAttribute, 'value'> & { id: string })
) & {
  list: string;
};
export type ImportFlatResource = Omit<FlatResource, 'referenceStringAttributes'> & {
  referenceStringAttributes: (ReferrableResourceReferenceAttribute & {
    key: string;
  })[];
};
export type ImportRequestBody = {
  importedResources: ImportFlatResource[];
  batch: ImportBatch;
};

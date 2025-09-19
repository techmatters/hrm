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
import { FlatResource, TimeSequence } from './Resources';

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
  toSequence: string;
  fromSequence: string;
  remaining: number;
};

export type ImportProgress = ImportBatch & {
  lastProcessedDate: string;
  lastProcessedId: string;
  // Leave vestigal support for no sequence ID, so it's easier to manually reset the import progress if required
  importSequenceId?: TimeSequence;
};

export type ImportRequestBody = {
  importedResources: FlatResource[];
  batch: ImportBatch;
};

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

export type InlineAttributeTable =
  | 'ResourceStringAttributes'
  | 'ResourceBooleanAttributes'
  | 'ResourceNumberAttributes'
  | 'ResourceDateTimeAttributes';

export type AseloInlineResourceAttribute<T extends InlineAttributeTable> = {
  key: string;
  value: AttributeValue<T>;
  info: Record<string, any> | null;
};

export type AseloTranslatableResourceAttribute = AseloInlineResourceAttribute<
  'ResourceStringAttributes'
> & {
  language: string;
};

export type AseloResource = {
  id: string;
  name: string;
  attributes: {
    ResourceStringAttributes: AseloTranslatableResourceAttribute[];
    ResourceReferenceStringAttributes: {
      key: string;
      value: string;
      language: string;
      info: Record<string, any> | null;
      list: string;
    }[];
    ResourceBooleanAttributes: AseloInlineResourceAttribute<'ResourceBooleanAttributes'>[];
    ResourceNumberAttributes: AseloInlineResourceAttribute<'ResourceNumberAttributes'>[];
    ResourceDateTimeAttributes: AseloInlineResourceAttribute<'ResourceDateTimeAttributes'>[];
  };
};

export type AttributeTable = InlineAttributeTable | 'ResourceReferenceStringAttributes';

export type AttributeValue<T extends AttributeTable> = T extends 'ResourceBooleanAttributes'
  ? boolean
  : T extends 'ResourceNumberAttributes'
  ? number
  : T extends 'ResourceDateTimeAttributes'
  ? Date
  : string;

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

export type InlineAttributeTable =
  | 'ResourceStringAttributes'
  | 'ResourceBooleanAttributes'
  | 'ResourceNumberAttributes'
  | 'ResourceDateAttributes';

export type AseloInlineResourceAttribute<T extends InlineAttributeTable> = {
  key: string;
  value: AttributeValue<T>;
  language: string;
  info: Record<string, any> | null;
};

export type AseloResource = {
  id: string;
  name: string;
  attributes: {
    ResourceStringAttributes: AseloInlineResourceAttribute<'ResourceStringAttributes'>[];
    ResourceReferenceStringAttributes: {
      key: string;
      value: string;
      language: string;
      info: Record<string, any> | null;
      list: string;
    }[];
    ResourceBooleanAttributes: AseloInlineResourceAttribute<'ResourceBooleanAttributes'>[];
    ResourceNumberAttributes: AseloInlineResourceAttribute<'ResourceNumberAttributes'>[];
    ResourceDateAttributes: AseloInlineResourceAttribute<'ResourceDateAttributes'>[];
  };
};

export type AttributeTable = InlineAttributeTable | 'ResourceReferenceStringAttributes';

export type AttributeValue<T extends AttributeTable> = T extends 'ResourceBooleanAttributes'
  ? boolean
  : T extends 'ResourceNumberAttributes'
  ? number
  : T extends 'ResourceDateAttributes'
  ? Date
  : string;

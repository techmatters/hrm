export type ReferrableResourceAttribute<T> = {
  value: T;
  info?: any;
};

export const isReferrableResourceAttribute = (
  attribute: any,
): attribute is ReferrableResourceAttribute<unknown> =>
  attribute &&
  (typeof attribute.value === 'string' ||
    typeof attribute.value === 'number' ||
    typeof attribute.value === 'boolean');

export type ReferrableResourceTranslatableAttribute = ReferrableResourceAttribute<string> & {
  language: string;
};

export type ResourceAttributeNode = Record<
  string,
  | (
      | ReferrableResourceAttribute<string | boolean | number>
      | ReferrableResourceTranslatableAttribute
    )[]
  | Record<
      string,
      (
        | ReferrableResourceAttribute<string | boolean | number>
        | ReferrableResourceTranslatableAttribute
      )[]
    >
>;

export type ReferrableResource = {
  name: string;
  id: string;
  attributes: ResourceAttributeNode;
};

export enum ResourcesJobType {
  SEARCH_INDEX = 'search-index',
}

type ResourcesJobMessageCommons = {
  accountSid: string;
};

export type ResourcesSearchIndexPayload = ResourcesJobMessageCommons & {
  jobType: ResourcesJobType.SEARCH_INDEX;
  resource: ReferrableResource;
};

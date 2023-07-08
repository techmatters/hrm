import { Client } from '@elastic/elasticsearch';

export type SuggestParameters = {
  prefix: string;
  size: number;
};

export type SuggestExtraParams = {
  suggestParameters: SuggestParameters;
};

export type SuggestParams = {
  client: Client;
  index: string;
  suggestParameters: SuggestParameters;
  searchConfig: any;
};

export const suggest = async ({
  client,
  index,
  searchConfig,
  suggestParameters,
}: SuggestParams) => {
  const { generateSuggestQuery } = searchConfig;

  const suggestQuery = {
    index,
    suggest: generateSuggestQuery(suggestParameters),
  };

  const res = await client.search(suggestQuery);
  console.dir(res, { depth: null });

  // const suggestions = body.suggest['resource-suggest'][0].options.map(option => {
  //   return {
  //     id: option._source.id,
  //     name: option._source.name,
  //   };
  // });
};

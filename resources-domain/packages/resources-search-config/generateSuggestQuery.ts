import { SearchSuggester } from '@elastic/elasticsearch/lib/api/types';
import { SuggestParameters } from '@tech-matters/elasticsearch-client';
import { getMappingFieldNamesByType } from './resourceIndexDocumentMappings';

export const generateSuggestQuery = ({ prefix, size }: SuggestParameters): SearchSuggester => {
  const suggestQuery: SearchSuggester = {};

  getMappingFieldNamesByType('completion').forEach(fieldName => {
    suggestQuery[fieldName] = {
      prefix,
      completion: {
        field: fieldName,
        size,
        skip_duplicates: true,
      },
    };
  });

  return suggestQuery;
};

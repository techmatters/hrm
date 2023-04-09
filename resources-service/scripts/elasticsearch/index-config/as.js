export const body = {
  settings: {
    analysis: {
      filter: {
        english_stemmer: {
          type: 'stemmer',
          language: 'english',
        },
        french_stemmer: {
          type: 'stemmer',
          language: 'french',
        },
      },
      analyzer: {
        rebuilt_english: {
          type: 'custom',
          tokenizer: 'standard',
          filter: ['lowercase', 'english_stemmer'],
        },
        rebuilt_french: {
          type: 'custom',
          tokenizer: 'standard',
          filter: ['lowercase', 'french_stemmer'],
        },
      },
    },
  },
  mappings: {
    properties: {
      name: {
        type: 'keyword',
        fields: {
          en: {
            type: 'keyword',
          },
          fr: {
            type: 'keyword',
          },
        },
      },
      text_1: {
        type: 'text',
        fields: {
          en: {
            type: 'text',
            analyzer: 'rebuilt_english',
          },
          fr: {
            type: 'text',
            analyzer: 'rebuilt_french',
          },
        },
      },
      text_2: {
        type: 'text',
        fields: {
          en: {
            type: 'text',
            analyzer: 'rebuilt_english',
          },
          fr: {
            type: 'text',
            analyzer: 'rebuilt_french',
          },
        },
      },
      // location: {
      //   type: 'geo_point',
      // },
      // some_hl_specific_custom_weighted_field_name: {
      //   type: 'text',
      //   fields: {
      //     en: {
      //       type: 'text',
      //       analyzer: 'rebuilt_english',
      //     },
      //     fr: {
      //       type: 'text',
      //       analyzer: 'rebuilt_french',
      //     },
      //   },
      // },
      // some_hl_specific_sortable_field_name: {
      //   type: 'keyword',
      //   fields: {
      //     en: {
      //       type: 'keyword',
      //     },
      //     fr: {
      //       type: 'keyword',
      //     },
      //   },
      // },
    },
  },
};

import { ReferrableResource, ResourcesIndexDocument } from '@tech-matters/types';

const HIGH_PRIORITY_ATTRIBUTES = ['title'];

type TextObject = {
  en: string[];
  fr: string[];
  [key: string]: string[];
};

export const convertDocument = (resource: ReferrableResource): ResourcesIndexDocument => {
  const { name } = resource;

  const text1: TextObject = {
    en: [],
    fr: [],
  };

  const text2: TextObject = {
    en: [],
    fr: [],
  };

  const pushToCorrectText = (key: string, language: string, value: string) => {
    if (HIGH_PRIORITY_ATTRIBUTES.includes(key)) {
      text1[language].push(value);
    } else {
      text2[language].push(value);
    }
  };

  const parseAttribute = (key: string, attribute: any) => {
    let language = 'en';
    if (attribute.language === 'fr') {
      language = 'fr';
    }

    pushToCorrectText(key, language, attribute.value);
  };

  Object.entries(resource.attributes).map(([key, attributes]) => {
    if (!Array.isArray(attributes)) {
      return parseAttribute(key, attributes);
    }

    attributes.map(attribute => {
      parseAttribute(key, attribute);
    });
  });

  return {
    name,
    text1,
    text2,
  };
};

import { ReferrableResource, ResourcesIndexDocument } from '@tech-matters/types';

const HIGH_PRIORITY_ATTRIBUTES = ['title'];

export const convertDocument = (resource: ReferrableResource): ResourcesIndexDocument => {
  const { name } = resource;

  const text1: string[] = [];

  const text2: string[] = [];

  const pushToCorrectText = (key: string, value: string) => {
    if (HIGH_PRIORITY_ATTRIBUTES.includes(key)) {
      text1.push(value);
    } else {
      text2.push(value);
    }
  };

  const parseAttribute = (key: string, attribute: any) => {
    pushToCorrectText(key, attribute.value);
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

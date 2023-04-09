import { convertDocument } from '../../../../src/config/as/convert-document-resources';

describe('convertDocument', () => {
  it('should convert a simple document', () => {
    // TODO: need a real example of a document to test against because I still have no idea what these are supposed to look like
    const resource = {
      name: 'Resource',
      id: '1234',
      attributes: {
        title: [
          { value: 'This is the english title', language: 'en', info: 'info about the title' },
          { value: 'This is the french title', language: 'fr' },
        ],
        description: [{ value: 'This is the description' }],
      },
    };

    const document = convertDocument(resource);

    expect(document).toEqual({
      name: 'Resource',
      text1: {
        en: ['This is the english title'],
        fr: ['This is the french title'],
      },
      text2: {
        en: ['This is the description'],
        fr: [],
      },
    });
  });
});

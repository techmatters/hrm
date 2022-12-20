import { getPersonsName } from '../../src/contact/contact-json';

describe('getPersonsName', () => {
  test('No name object - empty string', () => {
    expect(getPersonsName({})).toEqual('');
  });
  test('Name property has empty strings - single space', () => {
    expect(getPersonsName({ name: { firstName: '', lastName: '' } })).toEqual(' ');
  });
  test('Name property has populated lastName - last name with space before', () => {
    expect(getPersonsName({ name: { firstName: '', lastName: 'Ballantyne' } })).toEqual(
      ' Ballantyne',
    );
  });
  test('Name property has populated firstName - first name with space after', () => {
    expect(getPersonsName({ name: { firstName: 'Lorna', lastName: '' } })).toEqual('Lorna ');
  });
  test('Name property has populated firstName & lastName - space between', () => {
    expect(getPersonsName({ name: { firstName: 'Lorna', lastName: 'Ballantyne' } })).toEqual(
      'Lorna Ballantyne',
    );
  });
});

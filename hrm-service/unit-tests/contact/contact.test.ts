import * as contactDb from '../../src/contact/contact-data-access';
import { connectContactToCase } from '../../src/contact/contact';

jest.mock('../../src/contact/contact-data-access');

describe('connectContactToCase', () => {
  test('Returns contact produced by data access layer', async () => {
    const mockContact: contactDb.Contact = {
      id: 1234,
      accountSid: 'accountSid',
      csamReports: [],
    };
    const connectSpy = jest.spyOn(contactDb, 'connectToCase').mockResolvedValue(mockContact);
    const result = await connectContactToCase('accountSid', 'case-connector', '1234', '4321');
    expect(connectSpy).toHaveBeenCalledWith(
      'accountSid',
      '1234',
      expect.objectContaining({ caseId: '4321', updatedBy: 'case-connector' }),
    );
    expect(result).toStrictEqual(mockContact);
  });
  test('Throws if data access layer returns undefined', async () => {
    jest.spyOn(contactDb, 'connectToCase').mockResolvedValue(undefined);
    expect(connectContactToCase('accountSid', 'case-connector', '1234', '4321')).rejects.toThrow();
  });
});

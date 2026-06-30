/**
 * Copyright (C) 2021-2026 Technology Matters
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see https://www.gnu.org/licenses/.
 */
import {
  ICarolContactRecord,
  calculateConversationDuration,
  mapCategories,
  mapContact,
  parseICarolBoolean,
  parseS3Uri,
} from './contactMapper';

/**
 * Builds a minimal iCarol record, defaulting all columns to empty strings so
 * that individual tests only need to set the fields they care about.
 */
const buildRecord = (overrides: Partial<ICarolContactRecord> = {}): ICarolContactRecord =>
  ({
    CallReportNum: '',
    CallDateAndTimeStart: '',
    CallDateAndTimeEnd: '',
    CallLength: '',
    CallerName: '',
    PhoneWorkerName: '',
    StateProvince: '',
    CityName: '',
    CountyName: '',
    PhoneNumberFull: '',
    WasRealCall: '',
    WasHangup: '',
    WasSexCall: '',
    WasWrongNumber: '',
    WasPrankCall: '',
    WasSilentCall: '',
    'Call Information - Call Direction': '',
    'Call Information - Call Type': '',
    'Caller Demographics - 988 referral': '',
    'Caller Demographics - Age Range': '',
    'Caller Demographics - Ethnicity': '',
    'Caller Demographics - Gender': '',
    'Caller Demographics - Military Status': '',
    'Caller Demographics - Pronouns': '',
    'Caller Demographics - Race': '',
    'Incoming Call Information - How did you hear about the Warmline?': '',
    'Incoming Call Information - Do you want a call back': '',
    'Incoming Call Information - Have you been directly impacted by substance use?': '',
    'Follow up Outcome - Was the caller satisfied?': '',
    'Non-Crisis Response - Was Caller Satisfied?': '',
    'Referrals - Type of Resource': '',
    'The Eight Dimensions of Wellness - Eight Dimensions of Wellness - Check all that apply':
      '',
    ...overrides,
  }) as ICarolContactRecord;

describe('parseICarolBoolean', () => {
  test.each([
    ['Yes', true],
    ['yes', true],
    [' YES ', true],
    ['No', false],
    ['no', false],
    [' no ', false],
  ])('coerces "%s" to %s', (input, expected) => {
    expect(parseICarolBoolean(input)).toBe(expected);
  });

  test.each([undefined, '', '   ', 'maybe', 'true'])(
    'returns undefined for unrecognised value "%s"',
    input => {
      expect(parseICarolBoolean(input)).toBeUndefined();
    },
  );
});

describe('parseS3Uri', () => {
  test('parses bucket and key, excluding the leading slash', () => {
    expect(parseS3Uri('s3://my-bucket/path/to/export.csv')).toEqual({
      bucket: 'my-bucket',
      key: 'path/to/export.csv',
    });
  });

  test('decodes URL-encoded characters in the key', () => {
    expect(parseS3Uri('s3://my-bucket/path/my%20export.csv')).toEqual({
      bucket: 'my-bucket',
      key: 'path/my export.csv',
    });
  });

  test('handles a key at the bucket root', () => {
    expect(parseS3Uri('s3://my-bucket/export.csv')).toEqual({
      bucket: 'my-bucket',
      key: 'export.csv',
    });
  });

  test('throws when the URI is not an S3 URI', () => {
    expect(() => parseS3Uri('https://my-bucket/export.csv')).toThrow(
      'location must be an S3 URI',
    );
  });
});

describe('mapCategories', () => {
  test('returns an empty object when there are no dimensions', () => {
    expect(mapCategories(undefined)).toEqual({});
    expect(mapCategories('')).toEqual({});
  });

  test('maps a single dimension to its category and "Unspecified/Other" subcategory', () => {
    expect(mapCategories('Financial')).toEqual({
      Financial: ['Unspecified/Other - F'],
    });
  });

  test('maps multiple semicolon-separated dimensions', () => {
    expect(mapCategories('Financial;Physical;Social')).toEqual({
      Financial: ['Unspecified/Other - F'],
      Physical: ['Unspecified/Other - P'],
      Social: ['Unspecified/Other - S'],
    });
  });

  test('normalises whitespace and casing, including around the slash', () => {
    expect(mapCategories(' emotional / mental ;  ENVIRONMENTAL ')).toEqual({
      'Emotional/Mental': ['Unspecified/Other - EM'],
      Environmental: ['Unspecified/Other - E'],
    });
  });

  test('ignores empty entries and unrecognised dimensions', () => {
    expect(mapCategories('Financial;;Unknown Dimension;')).toEqual({
      Financial: ['Unspecified/Other - F'],
    });
  });
});

describe('mapContact', () => {
  test('maps support seeker fields onto childInformation', () => {
    const { rawJson } = mapContact(
      buildRecord({
        CallerName: 'Jane Doe',
        PhoneNumberFull: '+15555550123',
        StateProvince: 'CA',
        CityName: 'San Francisco',
        CountyName: 'San Francisco',
        'Caller Demographics - Age Range': '25-34',
        'Caller Demographics - Ethnicity': 'Hispanic',
        'Caller Demographics - Gender': 'Female',
        'Caller Demographics - Military Status': 'Veteran',
        'Caller Demographics - Pronouns': 'she/her',
        'Caller Demographics - Race': 'White',
        'Caller Demographics - 988 referral': 'Yes',
        'Incoming Call Information - How did you hear about the Warmline?': 'Friend',
      }),
    );

    expect(rawJson!.childInformation).toEqual({
      friendlyName: 'Jane Doe',
      phone1: '+15555550123',
      state: 'CA',
      county: 'San Francisco',
      ageRange: '25-34',
      ethnicity: 'Hispanic',
      gender: 'Female',
      militaryStatus: 'Veteran',
      pronouns: 'she/her',
      race: 'White',
      referral988: 'Yes',
      howDidYouHearAboutTheWarmLine: 'Friend',
    });
  });

  test('maps summary fields onto caseInformation, coercing Yes/No to booleans', () => {
    const { rawJson } = mapContact(
      buildRecord({
        'Follow up Outcome - Was the caller satisfied?': 'Yes',
        'Incoming Call Information - Do you want a call back': 'No',
        'Incoming Call Information - Have you been directly impacted by substance use?':
          'Yes',
        'Referrals - Type of Resource': 'Housing',
      }),
    );

    expect(rawJson!.caseInformation).toEqual({
      wasTheCallerSatisfiedWithTheSupportProvided: true,
      doWeHaveTheirPermissionToCallBack: false,
      substanceUseLivedExperience: true,
      referrals: 'Housing',
    });
  });

  test('falls back to the non-crisis satisfaction field when the follow up field is blank', () => {
    const { rawJson } = mapContact(
      buildRecord({
        'Non-Crisis Response - Was Caller Satisfied?': 'No',
      }),
    );

    expect(rawJson!.caseInformation.wasTheCallerSatisfiedWithTheSupportProvided).toBe(
      false,
    );
  });

  test('omits blank columns rather than populating empty values', () => {
    const { rawJson } = mapContact(buildRecord({ CallerName: 'Jane Doe' }));

    expect(rawJson!.childInformation).toEqual({ friendlyName: 'Jane Doe' });
    expect(rawJson!.caseInformation).toEqual({});
  });

  test('maps the eight dimensions of wellness onto categories', () => {
    const { rawJson } = mapContact(
      buildRecord({
        'The Eight Dimensions of Wellness - Eight Dimensions of Wellness - Check all that apply':
          'Financial;Physical',
      }),
    );

    expect(rawJson!.categories).toEqual({
      Financial: ['Unspecified/Other - F'],
      Physical: ['Unspecified/Other - P'],
    });
  });

  describe('callType', () => {
    test('maps a "Crisis" call to the data callType and records isCrisis true', () => {
      const { rawJson } = mapContact(
        buildRecord({ 'Call Information - Call Type': 'Crisis' }),
      );
      expect(rawJson!.callType).toBe('Child calling about self');
      expect(rawJson!.caseInformation.isCrisis).toBe(true);
    });

    test('maps a "Non-Crisis" call to the data callType and records isCrisis false', () => {
      const { rawJson } = mapContact(
        buildRecord({ 'Call Information - Call Type': 'Non-Crisis' }),
      );
      expect(rawJson!.callType).toBe('Child calling about self');
      expect(rawJson!.caseInformation.isCrisis).toBe(false);
    });

    test('infers a non-data callType from the boolean flags when call type is empty', () => {
      expect(mapContact(buildRecord({ WasHangup: 'Yes' })).rawJson!.callType).toBe(
        'Hang up',
      );
      expect(mapContact(buildRecord({ WasSilentCall: 'Yes' })).rawJson!.callType).toBe(
        'Silent',
      );
      expect(mapContact(buildRecord({ WasWrongNumber: 'Yes' })).rawJson!.callType).toBe(
        'Wrong  Number',
      );
      expect(mapContact(buildRecord({ WasPrankCall: 'Yes' })).rawJson!.callType).toBe(
        'Prank Call',
      );
      expect(mapContact(buildRecord({ WasSexCall: 'Yes' })).rawJson!.callType).toBe(
        'Sexual Gratifier',
      );
    });

    test('infers the data callType when WasRealCall is set but call type is empty', () => {
      expect(mapContact(buildRecord({ WasRealCall: 'Yes' })).rawJson!.callType).toBe(
        'Child calling about self',
      );
    });

    test('does not record isCrisis when inferring from boolean flags', () => {
      expect(
        mapContact(buildRecord({ WasHangup: 'Yes' })).rawJson!.caseInformation,
      ).not.toHaveProperty('isCrisis');
    });

    test('falls back to an empty callType when nothing is set', () => {
      expect(mapContact(buildRecord()).rawJson!.callType).toBe('');
    });
  });

  test('builds the task id and marks the contact as a voice channel', () => {
    const contact = mapContact(buildRecord({ CallReportNum: '12345' }));
    expect(contact.taskId).toBe('WT_iCarol_12345');
    expect(contact.channel).toBe('voice');
  });

  test('passes through the time of contact, using undefined when blank', () => {
    expect(
      mapContact(buildRecord({ CallDateAndTimeStart: '2024-01-01T00:00:00Z' }))
        .timeOfContact,
    ).toBe('2024-01-01T00:00:00Z');
    expect(
      mapContact(buildRecord({ CallDateAndTimeStart: '' })).timeOfContact,
    ).toBeUndefined();
  });

  test('derives the conversation duration (seconds) from the start and end timestamps', () => {
    expect(
      mapContact(
        buildRecord({
          CallDateAndTimeStart: '2026-05-06 15:22:00',
          CallDateAndTimeEnd: '2026-05-06 15:34:00',
        }),
      ).conversationDuration,
    ).toBe(720);
  });

  test('defaults the conversation duration to 0 when timestamps are missing or invalid', () => {
    expect(
      mapContact(buildRecord({ CallDateAndTimeStart: '2026-05-06 15:22:00' }))
        .conversationDuration,
    ).toBe(0);
    expect(
      mapContact(
        buildRecord({
          CallDateAndTimeStart: 'not a date',
          CallDateAndTimeEnd: '2026-05-06 15:34:00',
        }),
      ).conversationDuration,
    ).toBe(0);
  });
});

describe('calculateConversationDuration', () => {
  test('returns the difference between end and start in seconds', () => {
    expect(
      calculateConversationDuration('2026-05-06 15:22:00', '2026-05-06 15:34:00'),
    ).toBe(720);
  });

  test('returns 0 when either timestamp is missing', () => {
    expect(calculateConversationDuration('', '2026-05-06 15:34:00')).toBe(0);
    expect(calculateConversationDuration('2026-05-06 15:22:00', undefined)).toBe(0);
  });

  test('returns 0 when a timestamp is unparseable', () => {
    expect(calculateConversationDuration('nope', '2026-05-06 15:34:00')).toBe(0);
  });

  test('returns 0 when the end is before the start', () => {
    expect(
      calculateConversationDuration('2026-05-06 15:34:00', '2026-05-06 15:22:00'),
    ).toBe(0);
  });
});

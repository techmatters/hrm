/**
 * Copyright (C) 2021-2023 Technology Matters
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
import { Referral } from '../referral/referral-data-access';

type NestedInformation = { name?: { firstName: string; lastName: string } };

export type PersonInformation = NestedInformation & {
  [key: string]: string | boolean | NestedInformation[keyof NestedInformation]; // having NestedInformation[keyof NestedInformation] makes type looser here because of this https://github.com/microsoft/TypeScript/issues/17867. Possible/future solution https://github.com/microsoft/TypeScript/pull/29317
};

export type TwilioStoredMedia = {
  store: 'twilio';
  reservationSid: string;
};

export enum ContactMediaType {
  // RECORDING = 'recording',
  TRANSCRIPT = 'transcript',
}

export type S3StoredTranscript = {
  store: 'S3';
  type: ContactMediaType.TRANSCRIPT;
  location?: string;
  url?: string;
};

type S3StoredMedia = S3StoredTranscript;

export type ConversationMedia = TwilioStoredMedia | S3StoredMedia;

export const isTwilioStoredMedia = (m: ConversationMedia): m is TwilioStoredMedia =>
  m.store === 'twilio';
export const isS3StoredTranscript = (m: ConversationMedia): m is S3StoredTranscript =>
  m.store === 'S3' && m.type === ContactMediaType.TRANSCRIPT;
export const isS3StoredTranscriptPending = (m: ConversationMedia) =>
  isS3StoredTranscript(m) && !m.location;

/**
 * This and contained types are copied from Flex
 */
export type ContactRawJson = {
  definitionVersion?: string;
  callType: string;
  childInformation: PersonInformation;
  callerInformation?: PersonInformation;
  caseInformation: {
    categories: Record<string, Record<string, boolean>>;
    [key: string]: string | boolean | Record<string, Record<string, boolean>>;
  };
  contactlessTask?: { [key: string]: string | boolean };
  conversationMedia?: ConversationMedia[];
  referrals?: Referral[];
};

export const getPersonsName = (person: PersonInformation) =>
  person.name ? `${person.name.firstName} ${person.name.lastName}` : '';

// Represents a referral when part of a contact structure, so no contact ID
export type ReferralWithoutContactId = Omit<Referral, 'contactId'>;

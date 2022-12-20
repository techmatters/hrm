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
  url?: string;
};

type S3StoredMedia = S3StoredTranscript;

export type ConversationMedia = TwilioStoredMedia | S3StoredMedia;

export const isTwilioStoredMedia = (m: ConversationMedia): m is TwilioStoredMedia =>
  m.store === 'twilio';
export const isS3StoredTranscript = (m: ConversationMedia): m is S3StoredTranscript =>
  m.store === 'S3' && m.type === ContactMediaType.TRANSCRIPT;
export const isS3StoredTranscriptPending = (m: ConversationMedia) =>
  isS3StoredTranscript(m) && !m.url;

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
};

export const getPersonsName = (person: PersonInformation) =>
  person.name ? `${person.name.firstName} ${person.name.lastName}` : '';

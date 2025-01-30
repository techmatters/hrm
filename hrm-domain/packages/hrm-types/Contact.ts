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
import { HrmAccountId, TwilioUserIdentifier, WorkerSID } from '@tech-matters/types';
import { ConversationMedia } from './ConversationMedia';
import { Referral } from './Referral';
import { CaseService } from './Case';

/**
 * This and contained types are copied from Flex
 */
export type ContactRawJson = {
  definitionVersion?: string;
  callType: string;
  childInformation: {
    [key: string]: string | boolean;
  };
  callerInformation?: {
    [key: string]: string | boolean;
  };
  categories: Record<string, string[]>;
  caseInformation: {
    [key: string]: string | boolean;
  };
  contactlessTask?: { [key: string]: string | boolean };
  referrals?: Referral[];
};

// Represents a referral when part of a contact structure, so no contact ID
export type ReferralWithoutContactId = Omit<Referral, 'contactId'>;

export type NewContactRecord = {
  rawJson: ContactRawJson;
  queueName: string;
  twilioWorkerId?: WorkerSID;
  createdBy?: TwilioUserIdentifier;
  helpline?: string;
  number?: string;
  channel?: string;
  conversationDuration: number;
  timeOfContact?: string;
  taskId: string;
  channelSid?: string;
  serviceSid?: string;
  caseId?: CaseService['id'];
  profileId?: number;
  identifierId?: number;
  definitionVersion: string;
};

export type ExistingContactRecord = {
  id: number;
  accountSid: HrmAccountId;
  createdAt: string;
  finalizedAt?: string;
  updatedAt?: string;
  updatedBy?: TwilioUserIdentifier;
} & Partial<NewContactRecord>;

export type Contact = ExistingContactRecord & {
  csamReports: any[];
  referrals?: ReferralWithoutContactId[];
  conversationMedia?: ConversationMedia[];
};

export const dataCallTypes = {
  child: 'Child calling about self',
  caller: 'Someone calling about a child',
};

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

import { HrmAccountId, TwilioUserIdentifier } from '@tech-matters/types';

export type NewRecordCommons = {
  accountSid: HrmAccountId;
  createdAt: Date;
  updatedAt: Date;
  createdBy: TwilioUserIdentifier;
  updatedBy: TwilioUserIdentifier;
};

export type NewProfileRecord = {
  name: string | null;
};

export type NewIdentifierRecord = {
  identifier: string;
};

export type NewProfileToIdentifierRecord = {
  profileId: number;
  identifierId: number;
};

export type RecordCommons = {
  id: number;
  accountSid: HrmAccountId;
  createdAt: Date;
  updatedAt: Date;
  createdBy: TwilioUserIdentifier;
  updatedBy?: TwilioUserIdentifier;
};

export type Identifier = NewIdentifierRecord & RecordCommons;

export type IdentifierWithProfiles = Identifier & { profiles: Profile[] };

export type NewProfileFlagRecordCommons = {
  accountSid: HrmAccountId;
  createdAt: Date;
  updatedAt: Date;
  createdBy: TwilioUserIdentifier;
  updatedBy: TwilioUserIdentifier;
};

export type NewProfileFlagRecord = {
  name: string;
};

export type ProfileFlag = NewProfileFlagRecord & RecordCommons;

type ProfileFlagAssociation = {
  id: ProfileFlag['id'];
  validUntil: Date | null;
};

export type Profile = NewProfileRecord & RecordCommons;

export type NewProfileSectionRecordCommons = {
  accountSid: string;
  createdBy: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type NewProfileSectionRecord = {
  sectionType: string;
  profileId: number;
  content: string;
};

export type ProfileSection = NewProfileSectionRecord &
  RecordCommons & {
    createdBy: string;
    updatedBy?: string;
  };

export type ProfileWithRelationships = Profile & {
  identifiers: Identifier[];
  profileFlags: ProfileFlagAssociation[];
  profileSections: {
    sectionType: ProfileSection['sectionType'];
    id: ProfileSection['id'];
  }[];
  hasContacts: boolean;
};

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

export type PrecalculatedCasePermissionConditions = {
  isCaseContactOwner: boolean; // Does the requesting user own any of the contacts currently connected to the case?
};

export type CaseRecordCommon = {
  label: string;
  info: any;
  helpline: string;
  status: string;
  twilioWorkerId: WorkerSID;
  createdBy: TwilioUserIdentifier;
  updatedBy: TwilioUserIdentifier;
  accountSid: HrmAccountId;
  createdAt: string;
  updatedAt: string;
  statusUpdatedAt?: string;
  statusUpdatedBy?: string;
  previousStatus?: string;
  definitionVersion: string;
};

export type CaseInfoSection = {
  id: string;
  twilioWorkerId: string;
  updatedAt?: string;
  updatedBy?: string;
} & Record<string, any>;

type PrecalculatedPermissions = Record<'userOwnsContact', boolean>;

export type CaseService = CaseRecordCommon & {
  id: string;
  precalculatedPermissions?: PrecalculatedPermissions;
};

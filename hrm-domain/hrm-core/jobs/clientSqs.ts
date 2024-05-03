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

// import { HrmJobType } from '@tech-matters/types';
// import {  } from '@tech-matters/sqs-client'

import { CaseService } from '../case/caseService';
import { Contact } from '../contact/contactService';

export type IndexContactMessage = {
  type: 'contact';
  contact: Contact;
};

export type IndexCaseMessage = {
  type: 'case';
  case: Omit<CaseService, 'sections'> & {
    sections: NonNullable<CaseService['sections']>;
  };
};

export type IndexMessage = IndexContactMessage | IndexCaseMessage;

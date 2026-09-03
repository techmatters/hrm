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
import { BeaconDocumentSection, BeaconDocumentProcessor } from '../types';
import { AccountSID } from '@tech-matters/types';
import * as uscr from './uscr';
import * as gy from './gy';

export const createBeaconDocumentProcessor = (
  helplineCode: 'gy' | 'uscr' | 'as',
  apiType: 'incidentReport' | 'caseReport',
  accountSid: AccountSID,
): BeaconDocumentProcessor<BeaconDocumentSection> => {
  switch (helplineCode) {
    case 'uscr':
    case 'as':
      switch (apiType) {
        case 'incidentReport':
          return uscr.createIncidentReportProcessor(
            accountSid,
          ) as BeaconDocumentProcessor<BeaconDocumentSection>;
        case 'caseReport':
          return uscr.createCaseReportProcessor(
            accountSid,
          ) as BeaconDocumentProcessor<BeaconDocumentSection>;
        default:
          throw new Error(
            `No mappings configured for api '${apiType}' for helpline code: ${helplineCode} (attempting to look up account ${accountSid})`,
          );
      }
    case 'gy':
      switch (apiType) {
        case 'incidentReport':
          return gy.createIncidentReportProcessor(
            accountSid,
          ) as BeaconDocumentProcessor<BeaconDocumentSection>;
        case 'caseReport':
          return gy.createCaseReportProcessor(
            accountSid,
          ) as BeaconDocumentProcessor<BeaconDocumentSection>;
        default:
          throw new Error(
            `No mappings configured for api '${apiType}' for helpline code: ${helplineCode} (attempting to look up account ${accountSid})`,
          );
      }
    default:
      throw new Error(
        `No mappings configured for helpline code: ${helplineCode} (attempting to look up api '${apiType}', account ${accountSid})`,
      );
  }
};

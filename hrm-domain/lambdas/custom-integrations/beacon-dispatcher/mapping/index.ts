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

import * as uscr from './uscrMapping';
import * as gy from './gyMapping';

export const newCreateIncidentMapper = (helplineCode: string | undefined) => {
  switch (helplineCode) {
    case 'gy':
      return gy.toCreateIncident;
    case 'as':
    case 'uscr':
      return uscr.toCreateIncident;
    default:
      throw new Error(`No mappings configured for  for helpline code: ${helplineCode}`);
  }
};

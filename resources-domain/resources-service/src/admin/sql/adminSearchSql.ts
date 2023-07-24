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

import { SELECT_RESOURCES } from '../../resource/sql/resourceGetSql';

export const generateSelectResourcesForReindexSql = (
  resourceIdsSpecified: boolean,
) => `${SELECT_RESOURCES}
WHERE 
  ($<accountSid> IS NULL OR r."accountSid" = $<accountSid>) 
  AND ($<lastUpdatedFrom> IS NULL OR r."lastUpdated" >= $<lastUpdatedFrom>)
  AND ($<lastUpdatedTo> IS NULL OR r."lastUpdated" <= $<lastUpdatedTo>)
  ${resourceIdsSpecified ? 'AND r."id" IN ($<resourceIds:csv>)' : ''}
ORDER BY r."lastUpdated", r."accountSid", r."id"
LIMIT $<limit>
OFFSET $<start>
`;

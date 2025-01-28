-- Copyright (C) 2021-2023 Technology Matters
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU Affero General Public License as published
-- by the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.
--
-- This program is distributed in the hope that it will be useful,
-- but WITHOUT ANY WARRANTY; without even the implied warranty of
-- MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
-- GNU Affero General Public License for more details.
--
-- You should have received a copy of the GNU Affero General Public License
-- along with this program.  If not, see https://www.gnu.org/licenses/.

-- Removes all KHP reference locations except provinces, useful when updating the list of locations
DELETE FROM "resources"."ResourceReferenceStringAttributes" WHERE "list" IN ('cities', 'country/province/region', 'country/province/region/city');
DELETE FROM "resources"."ResourceReferenceStringAttributeValues" WHERE "list" IN ('cities', 'country/province/region', 'country/province/region/city');
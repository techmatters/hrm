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

'use strict';

module.exports = {
  up: async queryInterface => {
    await queryInterface.sequelize.query(`
      ALTER TABLE IF EXISTS public."CaseSections"
      ADD COLUMN IF NOT EXISTS "eventTimestamp" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP;
    `);
    console.log('"eventTimestamp" column added to table "CaseSections"');
    await queryInterface.sequelize.query(`
      UPDATE public."CaseSections" 
      SET "eventTimestamp" = CASE 
        WHEN "sectionType" = 'referral' AND "sectionTypeSpecificData"->>'date' != ''
        THEN ("sectionTypeSpecificData"->>'date')::TIMESTAMP WITH TIME ZONE
        ELSE "createdAt" 
      END;
    `);
    console.log('"eventTimestamp" column populated in table "CaseSections"');
  },

  down: async queryInterface => {
    await queryInterface.sequelize.query(`
      ALTER TABLE public."Cases" 
      DROP COLUMN IF EXISTS "eventTimestamp";
    `);
    console.log('"eventTimeStamp" column dropped from table "Cases"');
  },
};

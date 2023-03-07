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

module.exports = {
  up: async queryInterface => {
    await queryInterface.sequelize.query(`
	SELECT 
	id, 
	"rawJson"->'conversationMedia', 
	(jsonb_set("rawJson", '{"conversationMedia", 0, "location"}'::TEXT[], 
			   jsonb_build_object(
				   'bucket', (regexp_match("rawJson"->'conversationMedia'->0->>'url', 'https://(.*)\.s3\.(.*)amazonaws\.com/(.*)')::TEXT[])[1], 
				   'key', (regexp_match("rawJson"->'conversationMedia'->0->>'url', 'https://(.*)\.s3\.(.*)amazonaws\.com/(.*)')::TEXT[])[3]
			   )
			   , true)
	)->'conversationMedia' AS updated FROM public."Contacts" 
	WHERE "rawJson"->'conversationMedia'->0->>'store' = 'S3' AND "rawJson"->'conversationMedia'->0->>'url' IS NOT NULL`);

    await queryInterface.sequelize.query(`
	UPDATE public."Contacts"
	SET "rawJson"->'conversationMedia' = jsonb_set("rawJson", '{"conversationMedia", 0, "location"}'::TEXT[], 
			   jsonb_build_object(
				   'bucket', (regexp_match("rawJson"->'conversationMedia'->0->>'url', 'https://(.*)\.s3\.(.*)amazonaws\.com/(.*)')::TEXT[])[1], 
				   'key', (regexp_match("rawJson"->'conversationMedia'->0->>'url', 'https://(.*)\.s3\.(.*)amazonaws\.com/(.*)')::TEXT[])[3]
			   )
			   , true)
	WHERE "rawJson"->'conversationMedia'->0->>'store' = 'S3' AND "rawJson"->'conversationMedia'->0->>'url' IS NOT NULL`);
  },

  down: () => Promise.all([]),
};

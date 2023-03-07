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

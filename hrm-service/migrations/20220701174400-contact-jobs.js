// Whilst this is a POC there is no 'down' script or indexes on the table.
module.exports = {
  up: async queryInterface => {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS public."ContactJobs"
      (
        id bigint NOT NULL DEFAULT nextval('"ContactJobs_id_seq"'::regclass),
        "contactId" integer NOT NULL,
        "accountSid" text COLLATE pg_catalog."default" NOT NULL,
        "jobType" text COLLATE pg_catalog."default" NOT NULL,
        requested timestamp with time zone NOT NULL,
        completed timestamp with time zone,
        "lastAttempt" timestamp with time zone,
        "numberOfAttempts" integer NOT NULL DEFAULT 0,
        "additionalPayload" jsonb,
        "completionPayload" jsonb,
        CONSTRAINT "ContactJobs_pkey" PRIMARY KEY (id),
        CONSTRAINT "FK_ContactJobs_Contacts" FOREIGN KEY ("contactId", "accountSid")
            REFERENCES public."Contacts" (id, "accountSid") MATCH SIMPLE
            ON UPDATE NO ACTION
            ON DELETE NO ACTION
      )
    `);
    console.log('Table "ContactJobs" created');

    await queryInterface.sequelize.query(`      
      ALTER TABLE IF EXISTS public."ContactJobs"
          OWNER to hrm;
    `);
    console.log('Table "ContactJobs" now owned by HRM');

    await queryInterface.sequelize.query(`
      CREATE SEQUENCE IF NOT EXISTS public."ContactJobs_id_seq"
          INCREMENT 1
          START 1
          MINVALUE 1
          MAXVALUE 9223372036854775807
          CACHE 1
          OWNED BY "ContactJobs".id;
    `);
    console.log('Created sequence "ContactJobs_id_seq"');

    await queryInterface.sequelize.query(`
      ALTER SEQUENCE public."ContactJobs_id_seq"
          OWNER TO hrm;
    `);
    console.log('Sequence "ContactJobs_id_seq" now owned by HRM');
  },
};

'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
    CREATE SEQUENCE IF NOT EXISTS public."ContactJobsFailures_id_seq"
        INCREMENT 1
        START 1
        MINVALUE 1
        MAXVALUE 9223372036854775807
        CACHE 1
  `);
    console.log('Created sequence "ContactJobsFailures_id_seq"');

    await queryInterface.sequelize.query(`
    ALTER SEQUENCE public."ContactJobsFailures_id_seq"
        OWNER TO hrm;
  `);
    console.log('Sequence "ContactJobsFailures_id_seq" now owned by HRM');

    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS public."ContactJobsFailures"
      (
        id bigint NOT NULL DEFAULT nextval('"ContactJobsFailures_id_seq"'::regclass),
        "contactJobId" integer NOT NULL,
        "attemptNumber" integer NOT NULL,
        "payload" jsonb,
        "createdAt" timestamp with time zone NOT NULL,
        CONSTRAINT "ContactJobsFailures_pkey" PRIMARY KEY (id),
        CONSTRAINT "FK_ContactJobsFailures_ContactJobs" FOREIGN KEY ("contactJobId")
            REFERENCES public."ContactJobs" (id) MATCH SIMPLE
            ON UPDATE NO ACTION
            ON DELETE NO ACTION
      )
    `);
    console.log('Table "ContactJobsFailures" created');

    await queryInterface.sequelize.query(`
      ALTER TABLE IF EXISTS public."ContactJobsFailures"
        OWNER to hrm;
    `);
    console.log('Table "ContactJobsFailures" now owned by HRM');

    await queryInterface.sequelize.query(`
      ALTER TABLE IF EXISTS public."ContactJobs"
          DROP COLUMN IF EXISTS failedAttemptsPayloads;
    `);
    console.log('Table "ContactJobs.failedAttemptsPayloads" dropped');

    // await queryInterface.sequelize.query(`
    //   CREATE INDEX IF NOT EXISTS "ContactJobs_poll_due_idx" ON public."ContactJobs"
    //   USING btree ("completed", "numberOfAttempts", "lastAttempt", "contactId", "accountSid"));
    // `);
    // console.log('Index ContactJobs_poll_due_idx created');
  },

  async down(queryInterface, Sequelize) {
    // await queryInterface.sequelize.query(`DROP INDEX IF EXISTS "ContactJobs_poll_due_idx";`);
    // console.log('Index ContactJobs_poll_due_idx dropped');
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
  },
};

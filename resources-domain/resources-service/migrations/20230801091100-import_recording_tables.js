module.exports = {
  up: async queryInterface => {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS resources."ImportBatches"
      (
        "timestamp" timestamp with time zone NOT NULL DEFAULT now(),
        "batchId" text NOT NULL,
        "accountSid" text NOT NULL,
        "successCount" integer NOT NULL DEFAULT 0,
        "failureCount" integer NOT NULL DEFAULT 0,
        "remainingCount" integer NOT NULL DEFAULT 0,
        "batchContext" JSONB,
        CONSTRAINT "ImportBatches_pkey" PRIMARY KEY ("batchId", "accountSid")
      )
    `);
    console.log('Table "ImportBatches" created');

    await queryInterface.sequelize.query(`
      ALTER TABLE IF EXISTS resources."ImportBatches"
          OWNER to resources;
    `);
    console.log('Table "ImportBatches" now owned by resources');

    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS resources."ImportErrors"
      (
        id serial NOT NULL,
        "accountSid" text NOT NULL,
        "timestamp" timestamp with time zone NOT NULL DEFAULT now(),
        "batchId" text NOT NULL,
        "resourceId" text,
        "error" JSONB,
        "rejectedBatch" JSONB,
        CONSTRAINT "ImportErrors_pkey" PRIMARY KEY ("id", "accountSid")
      )
    `);
    console.log('Table "ImportErrors" created');

    await queryInterface.sequelize.query(`
      ALTER TABLE IF EXISTS resources."ImportErrors"
          OWNER to resources;
    `);
    console.log('Table "ImportErrors" now owned by resources');
  },

  down: async queryInterface => {
    await queryInterface.sequelize.query(
      `DROP TABLE IF EXISTS resources."ImportBatches"`,
    );
    console.log('Table "ImportBatches" dropped');
    await queryInterface.sequelize.query(`DROP TABLE IF EXISTS resources."ImportErrors"`);
    console.log('Table "ImportErrors" dropped');
  },
};

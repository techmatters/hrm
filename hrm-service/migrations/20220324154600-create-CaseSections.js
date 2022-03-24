module.exports = {
  up: async queryInterface => {
    console.log('UP!!');
    await queryInterface.sequelize.query(
      `CREATE SEQUENCE IF NOT EXISTS public."CaseSections_sectionId_seq"
        INCREMENT 1
        START 1
        MINVALUE 1
        MAXVALUE 9223372036854775807
        CACHE 1;`,
    );
    console.log("Sequence 'CaseSections_sectionId_seq' created");
    await queryInterface.sequelize.query(
      `ALTER SEQUENCE public."CaseSections_sectionId_seq" OWNER TO hrm`,
    );
    console.log("Sequence 'CaseSections_sectionId_seq' ownership altered.");
    await queryInterface.sequelize.query(`CREATE TABLE IF NOT EXISTS public."CaseSections"
      (
          "caseId" integer NOT NULL,
          "sectionType" text COLLATE pg_catalog."default" NOT NULL,
          "sectionId" text COLLATE pg_catalog."default" NOT NULL DEFAULT nextval('"CaseSections_sectionId_seq"'::regclass),
          "createdAt" timestamp with time zone NOT NULL,
          "createdBy" text COLLATE pg_catalog."default" NOT NULL,
          "updatedAt" timestamp with time zone,
          "updatedBy" text COLLATE pg_catalog."default",
          "sectionTypeSpecificData" jsonb,
          CONSTRAINT "CaseSections_pkey" PRIMARY KEY ("caseId", "sectionType", "sectionId"),
          CONSTRAINT "CaseSections_caseId_Case_id_fk" FOREIGN KEY ("caseId")
              REFERENCES public."Cases" (id) MATCH SIMPLE
              ON UPDATE CASCADE
              ON DELETE CASCADE
      )`);
    await queryInterface.sequelize.query(
      `ALTER TABLE IF EXISTS public."CaseSections" OWNER to hrm;`,
    );
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS "fki_CaseSections_caseId_Case_id_fk" ON public."CaseSections" USING btree
        ("caseId" ASC NULLS LAST)
      `);
    await queryInterface.sequelize.query(`
      INSERT INTO "CaseSections"
      SELECT
          cases.id AS caseId,
          'note' AS "sectionType",
          COALESCE(notes."id", nextval('"CaseSections_sectionId_seq"'::regclass)::text) AS "sectionId",
          notes."createdAt",
          notes."twilioWorkerId" AS "createdBy",
          notes."updatedAt",
          notes."updatedBy",
          jsonb_build_object('note', notes."note") AS "sectionTypeSpecificData"
      FROM "Cases" AS cases
          INNER JOIN LATERAL jsonb_to_recordset(cases.info::JSONB->'counsellorNotes') AS
          notes("note" text, "id" text, "twilioWorkerId" text, "createdAt" timestamp with time zone, "updatedBy" text, "updatedAt" timestamp with time zone) ON true
      UNION ALL
          SELECT
              cases.id AS caseId,
              'referral' AS "sectionType",
              COALESCE(referrals."id", nextval('"CaseSections_sectionId_seq"'::regclass)::text) AS "sectionId",
              referrals."createdAt",
              referrals."twilioWorkerId" AS "createdBy",
              referrals."updatedAt",
              referrals."updatedBy",
              jsonb_build_object('referredTo', referrals."referredTo", 'comment', referrals."comment", 'date', referrals."date") AS "sectionTypeSpecificData"
          FROM "Cases" AS cases
          INNER JOIN LATERAL jsonb_to_recordset(cases.info::JSONB->'referrals') AS
          referrals("referredTo" text, "date" text, "comment" text, "id" text, "twilioWorkerId" text, "createdAt" timestamp with time zone, "updatedBy" text, "updatedAt" timestamp with time zone) ON true
      UNION ALL
          SELECT
              cases.id AS caseId,
              'perpetrator' AS "sectionType",
              COALESCE(perpetrators."id", nextval('"CaseSections_sectionId_seq"'::regclass)::text) AS "sectionId",
              perpetrators."createdAt",
              perpetrators."twilioWorkerId" AS "createdBy",
              perpetrators."updatedAt",
              perpetrators."updatedBy",
              perpetrators."perpetrator" AS "sectionTypeSpecificData"
          FROM "Cases" AS cases
          INNER JOIN LATERAL jsonb_to_recordset(cases.info::JSONB->'perpetrators') AS
          perpetrators("perpetrator" jsonb, "id" text, "twilioWorkerId" text, "createdAt" timestamp with time zone, "updatedBy" text, "updatedAt" timestamp with time zone) ON true
      UNION ALL
          SELECT
              cases.id AS caseId,
              'household' AS "sectionType",
              COALESCE(households."id", nextval('"CaseSections_sectionId_seq"'::regclass)::text) AS "sectionId",
              households."createdAt",
              households."twilioWorkerId" AS "createdBy",
              households."updatedAt",
              households."updatedBy",
              households."household" AS "sectionTypeSpecificData"
          FROM "Cases" AS cases
          INNER JOIN LATERAL jsonb_to_recordset(cases.info::JSONB->'households') AS
          households("household" jsonb, "id" text, "twilioWorkerId" text, "createdAt" timestamp with time zone, "updatedBy" text, "updatedAt" timestamp with time zone) ON true
      UNION ALL
          SELECT
              cases.id AS caseId,
              'incident' AS "sectionType",
              COALESCE(incidents."id", nextval('"CaseSections_sectionId_seq"'::regclass)::text) AS "sectionId",
              incidents."createdAt",
              incidents."twilioWorkerId" AS "createdBy",
              incidents."updatedAt",
              incidents."updatedBy",
              incidents."incident" AS "sectionTypeSpecificData"
          FROM "Cases" AS cases
          INNER JOIN LATERAL jsonb_to_recordset(cases.info::JSONB->'incidents') AS
          incidents("incident" jsonb, "id" text, "twilioWorkerId" text, "createdAt" timestamp with time zone, "updatedBy" text, "updatedAt" timestamp with time zone) ON true
      UNION ALL
          SELECT
              cases.id AS caseId,
              'document' AS "sectionType",
              COALESCE(documents."id", nextval('"CaseSections_sectionId_seq"'::regclass)::text) AS "sectionId",
              documents."createdAt",
              documents."twilioWorkerId" AS "createdBy",
              documents."updatedAt",
              documents."updatedBy",
              documents."document" AS "sectionTypeSpecificData"
          FROM "Cases" AS cases
          INNER JOIN LATERAL jsonb_to_recordset(cases.info::JSONB->'documents') AS
          documents("document" jsonb, "id" text, "twilioWorkerId" text, "createdAt" timestamp with time zone, "updatedBy" text, "updatedAt" timestamp with time zone) ON true
      ORDER BY caseId, "sectionType", "sectionId"
    `);
  },
  down: async queryInterface => {
    await queryInterface.sequelize.query(`DROP TABLE public."CaseSections"`);
    await queryInterface.sequelize.query(`DROP SEQUENCE public."CaseSections_sectionId_seq"`);
  },
};

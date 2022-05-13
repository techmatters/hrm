module.exports = {
  up: async queryInterface => {
    await queryInterface.sequelize.transaction(async transaction => {
      console.log(
        'Initial schema creation. Checking if this step is required by checking if Contacts table already exists',
      );
      const [result] = await queryInterface.sequelize.query(
        `SELECT to_regclass('public."Contacts"') AS "tableExists"`,
        {
          transaction,
        },
      );
      console.log(result);
      if (!result[0].tableExists) {
        await queryInterface.sequelize.query(
          `
            CREATE TABLE public."AgeBrackets" (
                id integer NOT NULL,
                "createdAt" timestamp with time zone NOT NULL,
                "updatedAt" timestamp with time zone NOT NULL,
                min integer,
                max integer,
                bracket character varying(255)
            )
          `,
          { transaction },
        );
        await queryInterface.sequelize.query(
          `
            CREATE SEQUENCE public."AgeBrackets_id_seq"
                AS integer
                START WITH 1
                INCREMENT BY 1
                NO MINVALUE
                NO MAXVALUE
                CACHE 1;
      
          `,
          { transaction },
        );
        await queryInterface.sequelize.query(
          `
          ALTER SEQUENCE public."AgeBrackets_id_seq" OWNED BY public."AgeBrackets".id;
        `,
          { transaction },
        );
        await queryInterface.sequelize.query(
          `
            CREATE TABLE public."Contacts" (
              id integer NOT NULL,
              "createdAt" timestamp with time zone NOT NULL,
              "updatedAt" timestamp with time zone NOT NULL,
              "rawJson" jsonb,
              "queueName" character varying(255),
              "taskId" character varying(255),
              "AgeBracketId" integer,
              "SubcategoryId" integer,
              "timestamp" bigint,
              "reservationId" character varying(255)
          )
          `,
          { transaction },
        );
        await queryInterface.sequelize.query(
          `
            CREATE SEQUENCE public."Contacts_id_seq"
                AS integer
                START WITH 1
                INCREMENT BY 1
                NO MINVALUE
                NO MAXVALUE
                CACHE 1;
          `,
          { transaction },
        );
        await queryInterface.sequelize.query(
          `
            ALTER SEQUENCE public."Contacts_id_seq" OWNED BY public."Contacts".id
          `,
          { transaction },
        );
        await queryInterface.sequelize.query(
          `
            CREATE TABLE public."Subcategories" (
                id integer NOT NULL,
                "createdAt" timestamp with time zone NOT NULL,
                "updatedAt" timestamp with time zone NOT NULL,
                subcategory character varying(255)
            )
          `,
          { transaction },
        );
        await queryInterface.sequelize.query(
          `
          CREATE SEQUENCE public."Subcategories_id_seq"
              AS integer
              START WITH 1
              INCREMENT BY 1
              NO MINVALUE
              NO MAXVALUE
              CACHE 1;
        `,
          { transaction },
        );
        await queryInterface.sequelize.query(
          `
            ALTER SEQUENCE public."Subcategories_id_seq" OWNED BY public."Subcategories".id
          `,
          { transaction },
        );
        await queryInterface.sequelize.query(
          `
            ALTER TABLE ONLY public."AgeBrackets" ALTER COLUMN id SET DEFAULT nextval('public."AgeBrackets_id_seq"'::regclass)
          `,
          { transaction },
        );
        await queryInterface.sequelize.query(
          `
            ALTER TABLE ONLY public."Contacts" ALTER COLUMN id SET DEFAULT nextval('public."Contacts_id_seq"'::regclass)
          `,
          { transaction },
        );
        await queryInterface.sequelize.query(
          `
            ALTER TABLE ONLY public."Subcategories" ALTER COLUMN id SET DEFAULT nextval('public."Subcategories_id_seq"'::regclass)
          `,
          { transaction },
        );
        await queryInterface.sequelize.query(
          `
            SELECT pg_catalog.setval('public."AgeBrackets_id_seq"', 1, false)
          `,
          { transaction },
        );
        await queryInterface.sequelize.query(
          `
            SELECT pg_catalog.setval('public."Subcategories_id_seq"', 1, false)
          `,
          { transaction },
        );
        await queryInterface.sequelize.query(
          `
            ALTER TABLE ONLY public."AgeBrackets" 
            ADD CONSTRAINT "AgeBrackets_pkey" PRIMARY KEY (id)
          `,
          { transaction },
        );
        await queryInterface.sequelize.query(
          `
            ALTER TABLE ONLY public."Contacts"
            ADD CONSTRAINT "Contacts_pkey" PRIMARY KEY (id)
          `,
          { transaction },
        );
        await queryInterface.sequelize.query(
          `
            ALTER TABLE ONLY public."Subcategories"
            ADD CONSTRAINT "Subcategories_pkey" PRIMARY KEY (id);
          `,
          { transaction },
        );
        await queryInterface.sequelize.query(
          `
            ALTER TABLE ONLY public."Contacts"
            ADD CONSTRAINT "Contacts_AgeBracketId_fkey" FOREIGN KEY ("AgeBracketId") REFERENCES public."AgeBrackets"(id) ON UPDATE CASCADE ON DELETE SET NULL
          `,
          { transaction },
        );
        await queryInterface.sequelize.query(
          `
            ALTER TABLE ONLY public."Contacts"
            ADD CONSTRAINT "Contacts_SubcategoryId_fkey" FOREIGN KEY ("SubcategoryId") REFERENCES public."Subcategories"(id) ON UPDATE CASCADE ON DELETE SET NULL
          `,
          { transaction },
        );
      } else {
        console.log('SKIPPING INITIAL TABLE CREATION AS CONTACT TABLE EXISTS.');
      }
    });
  },

  down: () => Promise.all([]),
};

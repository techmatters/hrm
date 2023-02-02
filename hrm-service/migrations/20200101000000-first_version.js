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
    await queryInterface.sequelize.transaction(async transaction => {
      const [result] = await queryInterface.sequelize.query(
        `SELECT to_regclass('public."Contacts"') AS "tableExists"`,
        {
          transaction,
        },
      );
      if (!result[0].tableExists) {
        console.log('Attempting to build initial database schema.');
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
        console.log(
          'A "Contacts" table was found, so despite umzug thinking the base schema creation script is required, we will skip it.\n' +
            'This can happen because this base schema migration was added retroactively and is missing from some DBs migration state, or because the base schema was created manually prior to first deploying the service.',
        );
      }
    });
  },

  down: () => Promise.all([]),
};

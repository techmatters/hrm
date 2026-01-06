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

--
-- PostgreSQL database dump
--

-- Dumped from database version 12.10 (Debian 12.10-1.pgdg110+1)
-- Dumped by pg_dump version 12.10 (Debian 12.10-1.pgdg110+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;
SET default_tablespace = '';
SET default_with_oids = false;
SET default_table_access_method = heap;

--
-- Roles
--

-- Create user hrm if not exists
-- set password to postgres as that's used in the tests
DO
$do$
BEGIN
   IF EXISTS (
      SELECT FROM pg_catalog.pg_roles
      WHERE  rolname = 'hrm') THEN

      RAISE NOTICE 'Role "hrm" already exists. Skipping.';
   ELSE
      BEGIN   -- nested block
         CREATE ROLE hrm WITH PASSWORD 'postgres' VALID UNTIL 'infinity';
      EXCEPTION
         WHEN duplicate_object THEN
            RAISE NOTICE 'Role "hrm" was just created by a concurrent transaction. Skipping.';
      END;
   END IF;
END
$do$;

ALTER ROLE hrm WITH SUPERUSER INHERIT CREATEROLE CREATEDB LOGIN NOREPLICATION NOBYPASSRLS VALID UNTIL 'infinity';
CREATE ROLE rds_ad;
ALTER ROLE rds_ad WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB NOLOGIN NOREPLICATION NOBYPASSRLS;
CREATE ROLE rds_iam;
ALTER ROLE rds_iam WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB NOLOGIN NOREPLICATION NOBYPASSRLS;
CREATE ROLE rds_password;
ALTER ROLE rds_password WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB NOLOGIN NOREPLICATION NOBYPASSRLS;
CREATE ROLE rds_replication;
ALTER ROLE rds_replication WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB NOLOGIN NOREPLICATION NOBYPASSRLS;
CREATE ROLE rds_superuser;
ALTER ROLE rds_superuser WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB NOLOGIN NOREPLICATION NOBYPASSRLS;
ALTER ROLE rdsadmin WITH SUPERUSER INHERIT CREATEROLE CREATEDB LOGIN REPLICATION BYPASSRLS VALID UNTIL 'infinity';
CREATE ROLE rdsrepladmin;
ALTER ROLE rdsrepladmin WITH NOSUPERUSER NOINHERIT NOCREATEROLE NOCREATEDB NOLOGIN REPLICATION NOBYPASSRLS;
CREATE ROLE read_only_user;
ALTER ROLE read_only_user WITH NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB LOGIN NOREPLICATION NOBYPASSRLS;
--
-- User Configurations
--

ALTER ROLE rdsadmin SET "TimeZone" TO 'utc';
ALTER ROLE rdsadmin SET log_statement TO 'all';
ALTER ROLE rdsadmin SET log_min_error_statement TO 'debug5';
ALTER ROLE rdsadmin SET log_min_messages TO 'panic';
ALTER ROLE rdsadmin SET exit_on_error TO '0';
ALTER ROLE rdsadmin SET statement_timeout TO '0';
ALTER ROLE rdsadmin SET role TO 'rdsadmin';
ALTER ROLE rdsadmin SET "auto_explain.log_min_duration" TO '-1';
ALTER ROLE rdsadmin SET temp_file_limit TO '-1';
ALTER ROLE rdsadmin SET search_path TO 'pg_catalog', 'public';
ALTER ROLE rdsadmin SET "pg_hint_plan.enable_hint" TO 'off';
ALTER ROLE rdsadmin SET default_transaction_read_only TO 'off';
ALTER ROLE rdsadmin SET default_tablespace TO '';


--
-- Role memberships
--

GRANT pg_monitor TO rds_superuser WITH ADMIN OPTION GRANTED BY rdsadmin;
GRANT pg_signal_backend TO rds_superuser WITH ADMIN OPTION GRANTED BY rdsadmin;
GRANT rds_password TO rds_superuser WITH ADMIN OPTION GRANTED BY rdsadmin;
GRANT rds_replication TO rds_superuser WITH ADMIN OPTION GRANTED BY rdsadmin;
GRANT rds_superuser TO hrm GRANTED BY rdsadmin;

-- Database: hrmdb

-- CREATE DATABASE hrmdb
--     WITH
--     OWNER = hrm
--     ENCODING = 'UTF8'
--     LC_COLLATE = 'en_US.UTF-8'
--     LC_CTYPE = 'en_US.UTF-8'
--     TABLESPACE = pg_default
--     CONNECTION LIMIT = -1
--     IS_TEMPLATE = False;

ALTER DATABASE hrmdb OWNER TO hrm;

GRANT TEMPORARY, CONNECT ON DATABASE hrmdb TO PUBLIC;

GRANT ALL ON DATABASE hrmdb TO hrm;

GRANT CONNECT ON DATABASE hrmdb TO read_only_user;

-- SCHEMA: public

CREATE SCHEMA IF NOT EXISTS public
    AUTHORIZATION hrm;

ALTER SCHEMA public OWNER TO hrm;

COMMENT ON SCHEMA public
    IS 'standard public schema';

GRANT ALL ON SCHEMA public TO PUBLIC;

GRANT ALL ON SCHEMA public TO hrm;

GRANT USAGE ON SCHEMA public TO read_only_user;

--
-- Name: audit_trigger(); Type: FUNCTION; Schema: public; Owner: hrm
--

CREATE FUNCTION public.audit_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      DECLARE
        audit_row public."Audits";
      BEGIN
        IF TG_WHEN <> 'AFTER' THEN
          RAISE EXCEPTION 'audit_trigger() may only run as an AFTER trigger';
        END IF;

        IF (TG_LEVEL <> 'ROW' OR (TG_OP <> 'UPDATE' AND TG_OP <> 'INSERT' AND TG_OP <> 'DELETE')) THEN
          RAISE EXCEPTION 'audit_trigger() added as trigger for unhandled case: %, %',TG_OP, TG_LEVEL;
          RETURN NULL;
        END IF;
        
        audit_row = ROW(
          nextval('"Audits_id_seq"'::regclass), -- new audit id
          current_user,                         -- the current DB user
          TG_TABLE_NAME,                        -- target tabla name
          TG_OP,                                -- operation performed on target row
          to_jsonb(OLD),                        -- target record previous state
          to_jsonb(NEW),                        -- target record new state
          current_timestamp,                    -- transaction timestamp
          statement_timestamp(),                -- statement timestamp
          clock_timestamp()                     -- Current date and time (changes during statement execution)
        );

        INSERT INTO public."Audits" VALUES (audit_row.*);
        RETURN NULL;
      END
      $$;


ALTER FUNCTION public.audit_trigger() OWNER TO hrm;

--
-- Name: Audits_id_seq; Type: SEQUENCE; Schema: public; Owner: hrm
--

CREATE SEQUENCE public."Audits_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."Audits_id_seq" OWNER TO hrm;

--
-- Name: Audits; Type: TABLE; Schema: public; Owner: hrm
--

CREATE TABLE public."Audits" (
    id integer DEFAULT nextval('public."Audits_id_seq"'::regclass) NOT NULL,
    "user" text NOT NULL,
    "tableName" text NOT NULL,
    operation text NOT NULL,
    "oldRecord" jsonb,
    "newRecord" jsonb,
    timestamp_trx timestamp with time zone NOT NULL,
    timestamp_stm timestamp with time zone NOT NULL,
    timestamp_clock timestamp with time zone NOT NULL
);


ALTER TABLE public."Audits" OWNER TO hrm;

--
-- Name: CSAMReports; Type: TABLE; Schema: public; Owner: hrm
--

CREATE TABLE public."CSAMReports" (
    id integer NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "accountSid" character varying(255),
    "twilioWorkerId" character varying(255),
    "csamReportId" character varying(255),
    "contactId" integer
);


ALTER TABLE public."CSAMReports" OWNER TO hrm;

--
-- Name: CSAMReports_id_seq; Type: SEQUENCE; Schema: public; Owner: hrm
--

CREATE SEQUENCE public."CSAMReports_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."CSAMReports_id_seq" OWNER TO hrm;

--
-- Name: CSAMReports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: hrm
--

ALTER SEQUENCE public."CSAMReports_id_seq" OWNED BY public."CSAMReports".id;


--
-- Name: CaseAudits; Type: TABLE; Schema: public; Owner: hrm
--

CREATE TABLE public."CaseAudits" (
    id integer NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "caseId" integer,
    "twilioWorkerId" character varying(255),
    "previousValue" jsonb,
    "newValue" jsonb,
    "accountSid" character varying(255),
    "createdBy" character varying(255)
);


ALTER TABLE public."CaseAudits" OWNER TO hrm;

--
-- Name: CaseAudits_id_seq; Type: SEQUENCE; Schema: public; Owner: hrm
--

CREATE SEQUENCE public."CaseAudits_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."CaseAudits_id_seq" OWNER TO hrm;

--
-- Name: CaseAudits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: hrm
--

ALTER SEQUENCE public."CaseAudits_id_seq" OWNED BY public."CaseAudits".id;


--
-- Name: CaseSections_sectionId_seq; Type: SEQUENCE; Schema: public; Owner: hrm
--

CREATE SEQUENCE public."CaseSections_sectionId_seq"
    START WITH 100000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."CaseSections_sectionId_seq" OWNER TO hrm;

--
-- Name: CaseSections; Type: TABLE; Schema: public; Owner: hrm
--

CREATE TABLE public."CaseSections" (
    "caseId" integer NOT NULL,
    "sectionType" text NOT NULL,
    "sectionId" text DEFAULT nextval('public."CaseSections_sectionId_seq"'::regclass) NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "createdBy" text NOT NULL,
    "updatedAt" timestamp with time zone,
    "updatedBy" text,
    "sectionTypeSpecificData" jsonb
);


ALTER TABLE public."CaseSections" OWNER TO hrm;

--
-- Name: Cases; Type: TABLE; Schema: public; Owner: hrm
--

CREATE TABLE public."Cases" (
    id integer NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    status character varying(255),
    helpline character varying(255),
    info jsonb,
    "twilioWorkerId" character varying(255),
    "accountSid" character varying(255),
    "createdBy" character varying(255),
    "updatedBy" text
);


ALTER TABLE public."Cases" OWNER TO hrm;

--
-- Name: Cases_id_seq; Type: SEQUENCE; Schema: public; Owner: hrm
--

CREATE SEQUENCE public."Cases_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."Cases_id_seq" OWNER TO hrm;

--
-- Name: Cases_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: hrm
--

ALTER SEQUENCE public."Cases_id_seq" OWNED BY public."Cases".id;


--
-- Name: Contacts; Type: TABLE; Schema: public; Owner: hrm
--

CREATE TABLE public."Contacts" (
    id integer NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "rawJson" jsonb,
    "queueName" character varying(255),
    "twilioWorkerId" character varying(255),
    helpline character varying(255),
    number character varying(255),
    channel character varying(255),
    "conversationDuration" integer,
    "caseId" integer,
    "accountSid" character varying(255),
    "timeOfContact" timestamp with time zone,
    "taskId" character varying(255),
    "createdBy" character varying(255),
    "channelSid" character varying(255),
    "serviceSid" character varying(255),
    "updatedBy" text
);


ALTER TABLE public."Contacts" OWNER TO hrm;

--
-- Name: Contacts_id_seq; Type: SEQUENCE; Schema: public; Owner: hrm
--

CREATE SEQUENCE public."Contacts_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."Contacts_id_seq" OWNER TO hrm;

--
-- Name: Contacts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: hrm
--

ALTER SEQUENCE public."Contacts_id_seq" OWNED BY public."Contacts".id;


--
-- Name: PostSurveys; Type: TABLE; Schema: public; Owner: hrm
--

CREATE TABLE public."PostSurveys" (
    id integer NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "accountSid" character varying(255),
    "taskId" character varying(255),
    "contactTaskId" character varying(255),
    data jsonb
);


ALTER TABLE public."PostSurveys" OWNER TO hrm;

--
-- Name: PostSurveys_id_seq; Type: SEQUENCE; Schema: public; Owner: hrm
--

CREATE SEQUENCE public."PostSurveys_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."PostSurveys_id_seq" OWNER TO hrm;

--
-- Name: PostSurveys_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: hrm
--

ALTER SEQUENCE public."PostSurveys_id_seq" OWNED BY public."PostSurveys".id;


--
-- Name: SequelizeMeta; Type: TABLE; Schema: public; Owner: hrm
--

CREATE TABLE public."SequelizeMeta" (
    name character varying(255) NOT NULL
);


ALTER TABLE public."SequelizeMeta" OWNER TO hrm;

--
-- Name: CSAMReports id; Type: DEFAULT; Schema: public; Owner: hrm
--

ALTER TABLE ONLY public."CSAMReports" ALTER COLUMN id SET DEFAULT nextval('public."CSAMReports_id_seq"'::regclass);


--
-- Name: CaseAudits id; Type: DEFAULT; Schema: public; Owner: hrm
--

ALTER TABLE ONLY public."CaseAudits" ALTER COLUMN id SET DEFAULT nextval('public."CaseAudits_id_seq"'::regclass);


--
-- Name: Cases id; Type: DEFAULT; Schema: public; Owner: hrm
--

ALTER TABLE ONLY public."Cases" ALTER COLUMN id SET DEFAULT nextval('public."Cases_id_seq"'::regclass);


--
-- Name: Contacts id; Type: DEFAULT; Schema: public; Owner: hrm
--

ALTER TABLE ONLY public."Contacts" ALTER COLUMN id SET DEFAULT nextval('public."Contacts_id_seq"'::regclass);


--
-- Name: PostSurveys id; Type: DEFAULT; Schema: public; Owner: hrm
--

ALTER TABLE ONLY public."PostSurveys" ALTER COLUMN id SET DEFAULT nextval('public."PostSurveys_id_seq"'::regclass);


--
-- Data for Name: Audits; Type: TABLE DATA; Schema: public; Owner: hrm
--

COPY public."Audits" (id, "user", "tableName", operation, "oldRecord", "newRecord", timestamp_trx, timestamp_stm, timestamp_clock) FROM stdin;
\.


--
-- Data for Name: CSAMReports; Type: TABLE DATA; Schema: public; Owner: hrm
--

COPY public."CSAMReports" (id, "createdAt", "updatedAt", "accountSid", "twilioWorkerId", "csamReportId", "contactId") FROM stdin;
\.


--
-- Data for Name: CaseAudits; Type: TABLE DATA; Schema: public; Owner: hrm
--

COPY public."CaseAudits" (id, "createdAt", "updatedAt", "caseId", "twilioWorkerId", "previousValue", "newValue", "accountSid", "createdBy") FROM stdin;
\.


--
-- Data for Name: CaseSections; Type: TABLE DATA; Schema: public; Owner: hrm
--

COPY public."CaseSections" ("caseId", "sectionType", "sectionId", "createdAt", "createdBy", "updatedAt", "updatedBy", "sectionTypeSpecificData") FROM stdin;
\.


--
-- Data for Name: Cases; Type: TABLE DATA; Schema: public; Owner: hrm
--

COPY public."Cases" (id, "createdAt", "updatedAt", status, helpline, info, "twilioWorkerId", "accountSid", "createdBy", "updatedBy") FROM stdin;
\.


--
-- Data for Name: Contacts; Type: TABLE DATA; Schema: public; Owner: hrm
--

COPY public."Contacts" (id, "createdAt", "updatedAt", "rawJson", "queueName", "twilioWorkerId", helpline, number, channel, "conversationDuration", "caseId", "accountSid", "timeOfContact", "taskId", "createdBy", "channelSid", "serviceSid", "updatedBy") FROM stdin;
\.


--
-- Data for Name: PostSurveys; Type: TABLE DATA; Schema: public; Owner: hrm
--

COPY public."PostSurveys" (id, "createdAt", "updatedAt", "accountSid", "taskId", "contactTaskId", data) FROM stdin;
\.


--
-- Data for Name: SequelizeMeta; Type: TABLE DATA; Schema: public; Owner: hrm
--

COPY public."SequelizeMeta" (name) FROM stdin;
20200304175210-contact-add-columns.js
20200310140432-contact-add-conversationDuration.js
20200427210632-create-case.js
20200428160048-case-has-many-contacts.js
20200506172048-remove-agebracket-subcategory-timestamp-reservationid.js
20200507212012-create-case-audit.js
20200507212342-case-add-column-workerid.js
20200707174416-contact-remove-taskId.js
20201111150719-all-add-accountSid.js
20201124131224-timeOfContact.js
20210118174350-add-taskId.js
20210312163330-add-createdBy.js
20210630164641-add-channelsid-servicesid.js
20210826214305-create-postSurvey.js
20211122172057-create-CSAMReport.js
20220301134500-migrate-notes-to-counsellor-notes.js
20220324154600-create-CaseSections.js
20220415151254-add-updatedBy.js
20220415170355-create-Audits.js
\.


--
-- Name: Audits_id_seq; Type: SEQUENCE SET; Schema: public; Owner: hrm
--

SELECT pg_catalog.setval('public."Audits_id_seq"', 1, false);


--
-- Name: CSAMReports_id_seq; Type: SEQUENCE SET; Schema: public; Owner: hrm
--

SELECT pg_catalog.setval('public."CSAMReports_id_seq"', 2, true);


--
-- Name: CaseAudits_id_seq; Type: SEQUENCE SET; Schema: public; Owner: hrm
--

SELECT pg_catalog.setval('public."CaseAudits_id_seq"', 1, false);


--
-- Name: CaseSections_sectionId_seq; Type: SEQUENCE SET; Schema: public; Owner: hrm
--

SELECT pg_catalog.setval('public."CaseSections_sectionId_seq"', 100000, false);


--
-- Name: Cases_id_seq; Type: SEQUENCE SET; Schema: public; Owner: hrm
--

SELECT pg_catalog.setval('public."Cases_id_seq"', 1, false);


--
-- Name: Contacts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: hrm
--

SELECT pg_catalog.setval('public."Contacts_id_seq"', 625, true);


--
-- Name: PostSurveys_id_seq; Type: SEQUENCE SET; Schema: public; Owner: hrm
--

SELECT pg_catalog.setval('public."PostSurveys_id_seq"', 1, false);


--
-- Name: Audits Audits_pkey; Type: CONSTRAINT; Schema: public; Owner: hrm
--

ALTER TABLE ONLY public."Audits"
    ADD CONSTRAINT "Audits_pkey" PRIMARY KEY (id);


--
-- Name: CSAMReports CSAMReports_pkey; Type: CONSTRAINT; Schema: public; Owner: hrm
--

ALTER TABLE ONLY public."CSAMReports"
    ADD CONSTRAINT "CSAMReports_pkey" PRIMARY KEY (id);


--
-- Name: CaseAudits CaseAudits_pkey; Type: CONSTRAINT; Schema: public; Owner: hrm
--

ALTER TABLE ONLY public."CaseAudits"
    ADD CONSTRAINT "CaseAudits_pkey" PRIMARY KEY (id);


--
-- Name: CaseSections CaseSections_pkey; Type: CONSTRAINT; Schema: public; Owner: hrm
--

ALTER TABLE ONLY public."CaseSections"
    ADD CONSTRAINT "CaseSections_pkey" PRIMARY KEY ("caseId", "sectionType", "sectionId");


--
-- Name: Cases Cases_pkey; Type: CONSTRAINT; Schema: public; Owner: hrm
--

ALTER TABLE ONLY public."Cases"
    ADD CONSTRAINT "Cases_pkey" PRIMARY KEY (id);


--
-- Name: Contacts Contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: hrm
--

ALTER TABLE ONLY public."Contacts"
    ADD CONSTRAINT "Contacts_pkey" PRIMARY KEY (id);


--
-- Name: PostSurveys PostSurveys_pkey; Type: CONSTRAINT; Schema: public; Owner: hrm
--

ALTER TABLE ONLY public."PostSurveys"
    ADD CONSTRAINT "PostSurveys_pkey" PRIMARY KEY (id);


--
-- Name: SequelizeMeta SequelizeMeta_pkey; Type: CONSTRAINT; Schema: public; Owner: hrm
--

ALTER TABLE ONLY public."SequelizeMeta"
    ADD CONSTRAINT "SequelizeMeta_pkey" PRIMARY KEY (name);


--
-- Name: fki_CaseSections_caseId_Case_id_fk; Type: INDEX; Schema: public; Owner: hrm
--

CREATE INDEX "fki_CaseSections_caseId_Case_id_fk" ON public."CaseSections" USING btree ("caseId");


--
-- Name: CaseSections CaseSections_audit_trigger; Type: TRIGGER; Schema: public; Owner: hrm
--

CREATE TRIGGER "CaseSections_audit_trigger" AFTER INSERT OR DELETE OR UPDATE ON public."CaseSections" FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();


--
-- Name: Cases Cases_audit_trigger; Type: TRIGGER; Schema: public; Owner: hrm
--

CREATE TRIGGER "Cases_audit_trigger" AFTER INSERT OR DELETE OR UPDATE ON public."Cases" FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();


--
-- Name: Contacts Contacts_audit_trigger; Type: TRIGGER; Schema: public; Owner: hrm
--

CREATE TRIGGER "Contacts_audit_trigger" AFTER INSERT OR DELETE OR UPDATE ON public."Contacts" FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();


--
-- Name: CSAMReports CSAMReports_contactId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: hrm
--

ALTER TABLE ONLY public."CSAMReports"
    ADD CONSTRAINT "CSAMReports_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES public."Contacts"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: CaseAudits CaseAudits_caseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: hrm
--

ALTER TABLE ONLY public."CaseAudits"
    ADD CONSTRAINT "CaseAudits_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES public."Cases"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: CaseSections CaseSections_caseId_Case_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: hrm
--

ALTER TABLE ONLY public."CaseSections"
    ADD CONSTRAINT "CaseSections_caseId_Case_id_fk" FOREIGN KEY ("caseId") REFERENCES public."Cases"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Contacts Contacts_caseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: hrm
--

ALTER TABLE ONLY public."Contacts"
    ADD CONSTRAINT "Contacts_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES public."Cases"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- PostgreSQL database dump
--

-- Dumped from database version 11.10 (Ubuntu 11.10-1.pgdg18.04+1)
-- Dumped by pg_dump version 11.10 (Ubuntu 11.10-1.pgdg18.04+1)

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
    "accountSid" character varying(255)
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
    "accountSid" character varying(255)
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
    "taskId" character varying(255)
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
-- Name: SequelizeMeta; Type: TABLE; Schema: public; Owner: hrm
--

CREATE TABLE public."SequelizeMeta" (
    name character varying(255) NOT NULL
);


ALTER TABLE public."SequelizeMeta" OWNER TO hrm;

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
-- Name: CaseAudits_id_seq; Type: SEQUENCE SET; Schema: public; Owner: hrm
--

SELECT pg_catalog.setval('public."CaseAudits_id_seq"', 753, true);


--
-- Name: Cases_id_seq; Type: SEQUENCE SET; Schema: public; Owner: hrm
--

SELECT pg_catalog.setval('public."Cases_id_seq"', 655, true);


--
-- Name: Contacts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: hrm
--

SELECT pg_catalog.setval('public."Contacts_id_seq"', 3028, true);


--
-- Name: CaseAudits CaseAudits_pkey; Type: CONSTRAINT; Schema: public; Owner: hrm
--

ALTER TABLE ONLY public."CaseAudits"
    ADD CONSTRAINT "CaseAudits_pkey" PRIMARY KEY (id);


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
-- Name: SequelizeMeta SequelizeMeta_pkey; Type: CONSTRAINT; Schema: public; Owner: hrm
--

ALTER TABLE ONLY public."SequelizeMeta"
    ADD CONSTRAINT "SequelizeMeta_pkey" PRIMARY KEY (name);


--
-- Name: CaseAudits CaseAudits_caseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: hrm
--

ALTER TABLE ONLY public."CaseAudits"
    ADD CONSTRAINT "CaseAudits_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES public."Cases"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Contacts Contacts_caseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: hrm
--

ALTER TABLE ONLY public."Contacts"
    ADD CONSTRAINT "Contacts_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES public."Cases"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--


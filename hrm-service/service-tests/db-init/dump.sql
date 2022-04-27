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

SET default_table_access_method = heap;

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
    "createdBy" character varying(255)
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
    "serviceSid" character varying(255)
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

COPY public."Cases" (id, "createdAt", "updatedAt", status, helpline, info, "twilioWorkerId", "accountSid", "createdBy") FROM stdin;
\.


--
-- Data for Name: Contacts; Type: TABLE DATA; Schema: public; Owner: hrm
--

COPY public."Contacts" (id, "createdAt", "updatedAt", "rawJson", "queueName", "twilioWorkerId", helpline, number, channel, "conversationDuration", "caseId", "accountSid", "timeOfContact", "taskId", "createdBy", "channelSid", "serviceSid") FROM stdin;
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
\.


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


--
-- PostgreSQL database dump complete
--


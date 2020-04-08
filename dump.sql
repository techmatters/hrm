--
-- PostgreSQL database dump
--

-- Dumped from database version 11.7 (Ubuntu 11.7-2.pgdg18.04+1)
-- Dumped by pg_dump version 11.7 (Ubuntu 11.7-2.pgdg18.04+1)

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
-- Name: AgeBrackets; Type: TABLE; Schema: public; Owner: hrm
--

CREATE TABLE public."AgeBrackets" (
    id integer NOT NULL,
    bracket character varying(255),
    min integer,
    max integer,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


ALTER TABLE public."AgeBrackets" OWNER TO hrm;

--
-- Name: AgeBrackets_id_seq; Type: SEQUENCE; Schema: public; Owner: hrm
--

CREATE SEQUENCE public."AgeBrackets_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."AgeBrackets_id_seq" OWNER TO hrm;

--
-- Name: AgeBrackets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: hrm
--

ALTER SEQUENCE public."AgeBrackets_id_seq" OWNED BY public."AgeBrackets".id;


--
-- Name: Contacts; Type: TABLE; Schema: public; Owner: hrm
--

CREATE TABLE public."Contacts" (
    id integer NOT NULL,
    "timestamp" bigint,
    "taskId" character varying(255),
    "reservationId" character varying(255),
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "AgeBracketId" integer,
    "SubcategoryId" integer,
    "rawJson" jsonb,
    "queueName" character varying(255),
    "twilioWorkerId" character varying(255),
    helpline character varying(255),
    number character varying(255),
    channel character varying(255),
    "conversationDuration" integer
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
-- Name: Subcategories; Type: TABLE; Schema: public; Owner: hrm
--

CREATE TABLE public."Subcategories" (
    id integer NOT NULL,
    subcategory character varying(255),
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


ALTER TABLE public."Subcategories" OWNER TO hrm;

--
-- Name: Subcategories_id_seq; Type: SEQUENCE; Schema: public; Owner: hrm
--

CREATE SEQUENCE public."Subcategories_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."Subcategories_id_seq" OWNER TO hrm;

--
-- Name: Subcategories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: hrm
--

ALTER SEQUENCE public."Subcategories_id_seq" OWNED BY public."Subcategories".id;


--
-- Name: AgeBrackets id; Type: DEFAULT; Schema: public; Owner: hrm
--

ALTER TABLE ONLY public."AgeBrackets" ALTER COLUMN id SET DEFAULT nextval('public."AgeBrackets_id_seq"'::regclass);


--
-- Name: Contacts id; Type: DEFAULT; Schema: public; Owner: hrm
--

ALTER TABLE ONLY public."Contacts" ALTER COLUMN id SET DEFAULT nextval('public."Contacts_id_seq"'::regclass);


--
-- Name: Subcategories id; Type: DEFAULT; Schema: public; Owner: hrm
--

ALTER TABLE ONLY public."Subcategories" ALTER COLUMN id SET DEFAULT nextval('public."Subcategories_id_seq"'::regclass);


--
-- Data for Name: AgeBrackets; Type: TABLE DATA; Schema: public; Owner: hrm
--

COPY public."AgeBrackets" (id, bracket, min, max, "createdAt", "updatedAt") FROM stdin;
1	0-3	0	3	2019-08-15 13:41:11.922-03	2019-08-15 13:41:11.922-03
2	4-6	4	6	2019-08-15 13:41:11.922-03	2019-08-15 13:41:11.922-03
3	7-9	7	9	2019-08-15 13:41:11.922-03	2019-08-15 13:41:11.922-03
4	10-12	10	12	2019-08-15 13:41:11.922-03	2019-08-15 13:41:11.922-03
5	13-15	13	15	2019-08-15 13:41:11.922-03	2019-08-15 13:41:11.922-03
6	16-17	16	17	2019-08-15 13:41:11.922-03	2019-08-15 13:41:11.922-03
7	18-25	18	25	2019-08-15 13:41:11.922-03	2019-08-15 13:41:11.922-03
8	>25	26	120	2019-08-15 13:41:11.922-03	2019-08-15 13:41:11.922-03
9	Unknown	\N	\N	2019-08-15 13:41:11.922-03	2019-08-15 13:41:11.922-03
\.


--
-- Data for Name: Contacts; Type: TABLE DATA; Schema: public; Owner: hrm
--

--
-- Data for Name: SequelizeMeta; Type: TABLE DATA; Schema: public; Owner: hrm
--

COPY public."SequelizeMeta" (name) FROM stdin;
20200304175210-contact-add-columns.js
20200310140432-contact-add-conversationDuration.js
\.


--
-- Data for Name: Subcategories; Type: TABLE DATA; Schema: public; Owner: hrm
--

COPY public."Subcategories" (id, subcategory, "createdAt", "updatedAt") FROM stdin;
1	Emotional abuse	2019-08-15 13:41:23.118-03	2019-08-15 13:41:23.118-03
2	Gang violence	2019-08-15 13:41:23.118-03	2019-08-15 13:41:23.118-03
3	Emotional Bullying	2019-08-15 13:41:23.118-03	2019-08-15 13:41:23.118-03
4	Physical Bullying	2019-08-15 13:41:23.118-03	2019-08-15 13:41:23.118-03
5	Alcohol addiction	2019-08-15 13:41:23.118-03	2019-08-15 13:41:23.118-03
6	Alcohol experimentation	2019-08-15 13:41:23.118-03	2019-08-15 13:41:23.118-03
7	Access to HIV/AIDS Medication and Healthcare	2019-08-15 13:41:23.118-03	2019-08-15 13:41:23.118-03
8	Child living with HIV/AIDS	2019-08-15 13:41:23.118-03	2019-08-15 13:41:23.118-03
\.


--
-- Name: AgeBrackets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: hrm
--

SELECT pg_catalog.setval('public."AgeBrackets_id_seq"', 9, true);


--
-- Name: Contacts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: hrm
--

SELECT pg_catalog.setval('public."Contacts_id_seq"', 701, true);


--
-- Name: Subcategories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: hrm
--

SELECT pg_catalog.setval('public."Subcategories_id_seq"', 8, true);


--
-- Name: AgeBrackets AgeBrackets_pkey; Type: CONSTRAINT; Schema: public; Owner: hrm
--

ALTER TABLE ONLY public."AgeBrackets"
    ADD CONSTRAINT "AgeBrackets_pkey" PRIMARY KEY (id);


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
-- Name: Subcategories Subcategories_pkey; Type: CONSTRAINT; Schema: public; Owner: hrm
--

ALTER TABLE ONLY public."Subcategories"
    ADD CONSTRAINT "Subcategories_pkey" PRIMARY KEY (id);


--
-- Name: Contacts Contacts_AgeBracketId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: hrm
--

ALTER TABLE ONLY public."Contacts"
    ADD CONSTRAINT "Contacts_AgeBracketId_fkey" FOREIGN KEY ("AgeBracketId") REFERENCES public."AgeBrackets"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Contacts Contacts_SubcategoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: hrm
--

ALTER TABLE ONLY public."Contacts"
    ADD CONSTRAINT "Contacts_SubcategoryId_fkey" FOREIGN KEY ("SubcategoryId") REFERENCES public."Subcategories"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--


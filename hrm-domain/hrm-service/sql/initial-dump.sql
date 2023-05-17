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
-- Name: AgeBrackets; Type: TABLE; Schema: public; Owner: hrm
--

CREATE TABLE public."AgeBrackets" (
    id integer NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    min integer,
    max integer,
    bracket character varying(255)
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
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "rawJson" jsonb,
    "queueName" character varying(255),
    "taskId" character varying(255),
    "AgeBracketId" integer,
    "SubcategoryId" integer,
    "timestamp" bigint,
    "reservationId" character varying(255)
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
-- Name: Subcategories; Type: TABLE; Schema: public; Owner: hrm
--

CREATE TABLE public."Subcategories" (
    id integer NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    subcategory character varying(255)
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
-- Name: AgeBrackets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: hrm
--

SELECT pg_catalog.setval('public."AgeBrackets_id_seq"', 1, false);


--
-- Name: Contacts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: hrm
--

SELECT pg_catalog.setval('public."Contacts_id_seq"', 2832, true);


--
-- Name: Subcategories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: hrm
--

SELECT pg_catalog.setval('public."Subcategories_id_seq"', 1, false);


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


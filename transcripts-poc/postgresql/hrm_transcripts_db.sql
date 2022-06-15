--
-- PostgreSQL database dump
--

-- Dumped from database version 11.4
-- Dumped by pg_dump version 11.3
CREATE USER hrm_transcripts;
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

CREATE TABLE IF NOT EXISTS public."Conversations"
(
    "channelSid" text COLLATE pg_catalog."default" NOT NULL,
    "taskSid" text COLLATE pg_catalog."default",
    "contactId" text COLLATE pg_catalog."default",
    metadata jsonb,
    CONSTRAINT "Conversations_pkey" PRIMARY KEY ("channelSid")
)

ALTER TABLE IF EXISTS public."Conversations"
    OWNER to hrm_transcripts;


CREATE TABLE IF NOT EXISTS public."Messages"
(
    "channelSid" text COLLATE pg_catalog."default" NOT NULL,
    "conversationIndex" integer NOT NULL,
    language text COLLATE pg_catalog."default",
    "timestamp" timestamp with time zone NOT NULL,
    sender text COLLATE pg_catalog."default" NOT NULL,
    content text COLLATE pg_catalog."default" NOT NULL,
    content_tsvector tsvector,
    CONSTRAINT "Messages_pkey" PRIMARY KEY ("channelSid", "conversationIndex"),
    CONSTRAINT "Messages_channedSid_fkey" FOREIGN KEY ("channelSid")
        REFERENCES public."Conversations" ("channelSid") MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION
        NOT VALID
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public."Messages"
    OWNER to hrm_transcripts;

CREATE INDEX IF NOT EXISTS "content_GIN_EN_Index"
    ON public."Messages" USING gin
    (to_tsvector('english'::regconfig, content))
    WHERE language = 'en'::text OR language IS NULL;

CREATE INDEX IF NOT EXISTS "content_tsvector_GIN_EN_Index"
    ON public."Messages" USING gin
    (content_tsvector)
    WHERE language = 'en'::text OR language IS NULL;

CREATE INDEX IF NOT EXISTS "fki_Messages_channedSid_fkey"
    ON public."Messages" USING btree
    ("channelSid" COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;

CREATE TABLE public."SequelizeMeta" (
    name character varying(255) NOT NULL
);


ALTER TABLE public."SequelizeMeta" OWNER TO hrm_transcripts;
--
-- Data for Name: SequelizeMeta; Type: TABLE DATA; Schema: public; Owner: hrm
--

COPY public."SequelizeMeta" (name) FROM stdin;
\.

--
-- Name: SequelizeMeta SequelizeMeta_pkey; Type: CONSTRAINT; Schema: public; Owner: hrm
--

ALTER TABLE ONLY public."SequelizeMeta"
    ADD CONSTRAINT "SequelizeMeta_pkey" PRIMARY KEY (name);

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: hrm
--

REVOKE ALL ON SCHEMA public FROM rdsadmin;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO hrm_transcripts;
GRANT ALL ON SCHEMA public TO PUBLIC;

--
-- PostgreSQL database dump complete
--


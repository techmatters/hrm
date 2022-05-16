

CREATE TABLE public."AgeBrackets" (
    id integer NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    min integer,
    max integer,
    bracket character varying(255)
);

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

ALTER SEQUENCE public."AgeBrackets_id_seq" OWNED BY public."AgeBrackets".id;

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

CREATE SEQUENCE public."Contacts_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Contacts_id_seq" OWNED BY public."Contacts".id;

CREATE TABLE public."Subcategories" (
    id integer NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    subcategory character varying(255)
);

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


--
-- Name: Subcategories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: hrm
--

ALTER SEQUENCE public."Subcategories_id_seq" OWNED BY public."Subcategories".id;
ALTER TABLE ONLY public."AgeBrackets" ALTER COLUMN id SET DEFAULT nextval('public."AgeBrackets_id_seq"'::regclass);
ALTER TABLE ONLY public."Contacts" ALTER COLUMN id SET DEFAULT nextval('public."Contacts_id_seq"'::regclass);
ALTER TABLE ONLY public."Subcategories" ALTER COLUMN id SET DEFAULT nextval('public."Subcategories_id_seq"'::regclass);
SELECT pg_catalog.setval('public."AgeBrackets_id_seq"', 1, false);
SELECT pg_catalog.setval('public."Contacts_id_seq"', 2832, true);
SELECT pg_catalog.setval('public."Subcategories_id_seq"', 1, false);
ALTER TABLE ONLY public."AgeBrackets"
    ADD CONSTRAINT "AgeBrackets_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."Contacts"
    ADD CONSTRAINT "Contacts_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."Subcategories"
    ADD CONSTRAINT "Subcategories_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."Contacts"
    ADD CONSTRAINT "Contacts_AgeBracketId_fkey" FOREIGN KEY ("AgeBracketId") REFERENCES public."AgeBrackets"(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY public."Contacts"
    ADD CONSTRAINT "Contacts_SubcategoryId_fkey" FOREIGN KEY ("SubcategoryId") REFERENCES public."Subcategories"(id) ON UPDATE CASCADE ON DELETE SET NULL;



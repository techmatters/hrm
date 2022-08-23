CREATE USER resource_document;

-- SCHEMA: resource_document

-- DROP SCHEMA IF EXISTS resource_document ;

CREATE SCHEMA IF NOT EXISTS resource_document
    AUTHORIZATION resource_document;

-- Table: resource_document.Resources

-- DROP TABLE IF EXISTS resource_document."Resources";

CREATE TABLE IF NOT EXISTS resource_document."Resources"
(
    id text COLLATE pg_catalog."default" NOT NULL,
    "accountSid" text COLLATE pg_catalog."default" NOT NULL,
    name text COLLATE pg_catalog."default" NOT NULL,
    attributes jsonb NOT NULL,
    CONSTRAINT "Resources_pkey" PRIMARY KEY (id, "accountSid")
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS resource_document."Resources"
    OWNER to resource_document;

-- Table: resource_document.ResourceReferenceAttributeValues

-- DROP TABLE IF EXISTS resource_document."ResourceReferenceAttributeValues";

CREATE TABLE IF NOT EXISTS resource_document."ResourceReferenceAttributeValues"
(
    id text COLLATE pg_catalog."default" NOT NULL,
    "accountSid" text COLLATE pg_catalog."default" NOT NULL,
    key text COLLATE pg_catalog."default" NOT NULL,
    value text COLLATE pg_catalog."default" NOT NULL,
    "valueLabel" text COLLATE pg_catalog."default",
    language text COLLATE pg_catalog."default",
    CONSTRAINT "ResourceReferenceAttributeValues_pkey" PRIMARY KEY (id, "accountSid")
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS resource_document."ResourceReferenceAttributeValues"
    OWNER to resource_document;
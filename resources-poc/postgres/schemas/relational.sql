
CREATE USER resource_relational;

-- SCHEMA: resource_relational

-- DROP SCHEMA IF EXISTS resource_relational ;

CREATE SCHEMA IF NOT EXISTS resource_relational
    AUTHORIZATION resource_relational;

-- Table: resource_relational.ResourceReferenceAttributeValues

-- DROP TABLE IF EXISTS resource_relational."ResourceReferenceAttributeValues";

CREATE TABLE IF NOT EXISTS resource_relational."ResourceReferenceAttributeValues"
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

ALTER TABLE IF EXISTS resource_relational."ResourceReferenceAttributeValues"
    OWNER to resource_relational;

-- Table: resource_relational.Resources

-- DROP TABLE IF EXISTS resource_relational."Resources";

CREATE TABLE IF NOT EXISTS resource_relational."Resources"
(
    id text COLLATE pg_catalog."default" NOT NULL,
    name text COLLATE pg_catalog."default" NOT NULL,
    "accountSid" text COLLATE pg_catalog."default" NOT NULL,
    CONSTRAINT "Resources_pkey" PRIMARY KEY (id, "accountSid")
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS resource_relational."Resources"
    OWNER to resource_relational;

-- Table: resource_relational.ResourceStringAttributes

-- DROP TABLE IF EXISTS resource_relational."ResourceStringAttributes";

CREATE TABLE IF NOT EXISTS resource_relational."ResourceStringAttributes"
(
    "resourceId" text COLLATE pg_catalog."default" NOT NULL,
    key text COLLATE pg_catalog."default" NOT NULL,
    value text COLLATE pg_catalog."default" NOT NULL,
    "valueLabel" text COLLATE pg_catalog."default",
    language text COLLATE pg_catalog."default",
    "accountSid" text COLLATE pg_catalog."default" NOT NULL,
    CONSTRAINT "ResourceStringAttributes_pkey" PRIMARY KEY ("resourceId", key, value, "accountSid"),
    CONSTRAINT "Resources_rsourceId_accountSid_fkey" FOREIGN KEY ("accountSid", "resourceId")
        REFERENCES resource_relational."Resources" ("accountSid", id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION
        NOT VALID
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS resource_relational."ResourceStringAttributes"
    OWNER to resource_relational;
-- Index: fki_Resources_rsourceId_accountSid_fkey

-- DROP INDEX IF EXISTS resource_relational."fki_Resources_rsourceId_accountSid_fkey";

CREATE INDEX IF NOT EXISTS "fki_Resources_rsourceId_accountSid_fkey"
    ON resource_relational."ResourceStringAttributes" USING btree
    ("resourceId" COLLATE pg_catalog."default" ASC NULLS LAST, "accountSid" COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;

-- Table: resource_relational.ResourceReferenceAttributes

-- DROP TABLE IF EXISTS resource_relational."ResourceReferenceAttributes";

CREATE TABLE IF NOT EXISTS resource_relational."ResourceReferenceAttributes"
(
    "resourceId" text COLLATE pg_catalog."default" NOT NULL,
    "referenceId" text COLLATE pg_catalog."default" NOT NULL,
    "accountSid" text COLLATE pg_catalog."default" NOT NULL,
    CONSTRAINT "ResourceReferenceAttributes_pkey" PRIMARY KEY ("resourceId", "referenceId", "accountSid"),
    CONSTRAINT "ResourceReferenceAttributeValues_referenceId_accountSid_fkey" FOREIGN KEY ("accountSid", "referenceId")
        REFERENCES resource_relational."ResourceReferenceAttributeValues" ("accountSid", id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION
        NOT VALID,
    CONSTRAINT "Resources_rsourceId_accountSid_fkey" FOREIGN KEY ("accountSid", "resourceId")
        REFERENCES resource_relational."Resources" ("accountSid", id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION
        NOT VALID
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS resource_relational."ResourceReferenceAttributes"
    OWNER to resource_relational;
-- Index: fki_ResourceReferenceAttributeValues_referenceId_accountSid_fke

-- DROP INDEX IF EXISTS resource_relational."fki_ResourceReferenceAttributeValues_referenceId_accountSid_fke";

CREATE INDEX IF NOT EXISTS "fki_ResourceReferenceAttributeValues_referenceId_accountSid_fke"
    ON resource_relational."ResourceReferenceAttributes" USING btree
    ("referenceId" COLLATE pg_catalog."default" ASC NULLS LAST, "accountSid" COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;

-- Index: ResourceStringAttributes_value_idx

-- DROP INDEX IF EXISTS resource_relational."ResourceStringAttributes_value_idx";

CREATE INDEX IF NOT EXISTS "ResourceStringAttributes_value_idx"
    ON resource_relational."ResourceStringAttributes" USING btree
    (value COLLATE pg_catalog."default" text_pattern_ops ASC NULLS LAST, "accountSid" COLLATE pg_catalog."default" ASC NULLS LAST)
    INCLUDE("valueLabel", language)
    TABLESPACE pg_default;


-- Index: ResourceReferenceAttributeValues_value_idx

-- DROP INDEX IF EXISTS resource_relational."ResourceReferenceAttributeValues_value_idx";

CREATE INDEX IF NOT EXISTS "ResourceReferenceAttributeValues_value_idx"
    ON resource_relational."ResourceReferenceAttributeValues" USING btree
    (value COLLATE pg_catalog."default" text_pattern_ops ASC NULLS LAST, "accountSid" COLLATE pg_catalog."default" ASC NULLS LAST)
    INCLUDE("valueLabel", language)
    TABLESPACE pg_default;
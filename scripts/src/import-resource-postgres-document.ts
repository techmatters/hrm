import pgPromise from 'pg-promise';
import { Reference, Resource } from './json-resource-types';
import { importItems } from './resource-importer';

const RESOURCES_DIRECTORY = '../resources-poc/resource-json';
const REFERENCES_DIRECTORY = '../resources-poc/reference-json';
const DB_CONFIG = {
  password: null,
  username: 'resource_document',
  host: 'localhost',
  port: 5432,
  database: 'hrmdb',
};

const pgp = pgPromise({
  schema: 'resource_document',
});

export const db = pgp(
  `postgres://${encodeURIComponent(DB_CONFIG.username)}:${encodeURIComponent(DB_CONFIG.password)}@${
    DB_CONFIG.host
  }:${DB_CONFIG.port}/${encodeURIComponent(DB_CONFIG.database)}?&application_name=hrm-service`,
);

async function insertReference(ref: Reference) {
  await db.tx(async connection => {
    const referenceInsertSql = pgp.helpers.insert(ref, null, 'ResourceReferenceAttributeValues');
    await connection.none(referenceInsertSql);
  });
}

async function insertResource(resource: Resource) {
  await db.tx(async connection => {
    const resourceInsertSql = pgp.helpers.insert(resource, null, 'Resources');
    await connection.none(resourceInsertSql);
  });
}

async function main() {
  const [, , ...args] = process.argv;

  console.log('Parsing arguments.');
  if (args.length !== 1) {
    console.error(
      `Number of conversations not set, assuming entire contents of '${REFERENCES_DIRECTORY}' and '${RESOURCES_DIRECTORY}' is to be imported`,
    );
  }
  const maxNumberOfResources = Number.parseInt(args.pop());

  await importItems(REFERENCES_DIRECTORY, insertReference);
  await importItems(RESOURCES_DIRECTORY, insertResource, maxNumberOfResources);
}

main().catch(err => {
  throw err;
});

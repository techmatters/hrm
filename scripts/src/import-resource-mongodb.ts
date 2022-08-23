import { Reference, Resource } from './json-resource-types';
import { importItems } from './resource-importer';
import { MongoClient } from 'mongodb';

const RESOURCES_DIRECTORY = '../resources-poc/resource-json';
const REFERENCES_DIRECTORY = '../resources-poc/reference-json';
const BATCH_SIZE = 5000;

const DB_CONFIG = {
  password: `p0c`,
  username: 'resource-poc',
  host: 'localhost',
  port: 27017,
};

type ResourceDocument = Resource & { _id: string };
type ReferenceDocument = Reference & { _id: string };

const currentResourceBatch: ResourceDocument[] = [];
const currentReferenceBatch: ReferenceDocument[] = [];

let currentResourceBatchNo = 0,
  currentReferenceBatchNo = 0;

async function main() {
  const mongo = new MongoClient(
    `mongodb://${encodeURIComponent(DB_CONFIG.username)}:${encodeURIComponent(
      DB_CONFIG.password,
    )}@${DB_CONFIG.host}:${DB_CONFIG.port}/?maxPoolSize=20&w=majority`,
  );

  try {
    const db = mongo.db('resource');

    async function flushReferenceBatch() {
      currentReferenceBatchNo++;
      console.log(
        `Inserting reference batch ${currentReferenceBatchNo} (docs ${currentReferenceBatchNo *
          BATCH_SIZE} - ${(currentReferenceBatchNo + 1) * BATCH_SIZE})`,
      );
      await db.collection<ReferenceDocument>('references').insertMany(currentReferenceBatch);
      currentReferenceBatch.length = 0;
    }

    async function insertReference(ref: Reference) {
      currentReferenceBatch.push({ _id: `${ref.accountSid}/${ref.id}`, ...ref });
      if (currentReferenceBatch.length > BATCH_SIZE) {
        await flushReferenceBatch();
      }
    }

    async function flushResourceBatch() {
      currentResourceBatchNo++;
      console.log(
        `Inserting resource batch ${currentResourceBatchNo} (docs ${currentResourceBatchNo *
          BATCH_SIZE} - ${(currentResourceBatchNo + 1) * BATCH_SIZE})`,
      );
      await db.collection<ResourceDocument>('resources').insertMany(currentResourceBatch);
      currentResourceBatch.length = 0;
    }

    async function insertResource(resource: Resource) {
      currentResourceBatch.push({ _id: `${resource.accountSid}/${resource.id}`, ...resource });
      if (currentResourceBatch.length > BATCH_SIZE) {
        await flushResourceBatch();
      }
    }
    const [, , ...args] = process.argv;

    console.log('Parsing arguments.');
    if (args.length !== 1) {
      console.error(
        `Number of conversations not set, assuming entire contents of '${REFERENCES_DIRECTORY}' and '${RESOURCES_DIRECTORY}' is to be imported`,
      );
    }
    const maxNumberOfResources = Number.parseInt(args.pop());

    console.log('Dropping existing collections');
    await db.dropCollection('resources');
    await db.dropCollection('references');

    console.log('Adding references');
    await importItems(REFERENCES_DIRECTORY, insertReference);
    await flushReferenceBatch();
    console.log(`Wrote ${await db.collection('references').countDocuments()} reference documents`);
    console.log('Adding resources');
    await importItems(RESOURCES_DIRECTORY, insertResource, maxNumberOfResources);
    await flushResourceBatch();
    console.log(`Wrote ${await db.collection('resources').countDocuments()} resource documents`);
    console.log('Creating resource indexes');
    await db
      .collection('resources')
      .createIndexes([
        { key: { 'attributes.inlineCategories': 1 } },
        { key: { 'attributes.referenceCategories': 1 } },
        { key: { accountSid: 1 } },
      ]);
    console.log('Creating reference indexes');
    await db.collection('resources').createIndexes([{ key: { accountSid: 1, key: 1, value: 1 } }]);
  } finally {
    await mongo.close();
  }
}

main().catch(err => {
  throw err;
});

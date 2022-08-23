import { promises as fsPromises } from 'fs';
import { randomUUID } from 'crypto';

const CATEGORY_TREE_DEPTH = 5;
const CATEGORY_TREE_CHILDREN_PER_NODE = 5;
const MAX_CATEGORIES_PER_RESOURCE = 3;
const MIN_CATEGORIES_PER_RESOURCE = 1;
const RESOURCES_PER_FILE = 50000;
const REFERENCES_PER_FILE = 20000;
const ROOT_RESOURCE_DIRECTORY = '../resources-poc/resource-json';
const ROOT_REFERENCE_DIRECTORY = '../resources-poc/reference-json';
const ACCOUNT_SIDS = new Array(10).fill(0).map((_, idx) => `ACCOUNT_${idx}`);
const CITIES = [
  'Anderson Station',
  'Ceres',
  'Eros',
  'Ganymede',
  'Iapetus Station',
  'Kelso Station',
  'Medina Station',
  'Oshima',
  'Osiris Station',
  'Phoebe',
  'Prospero Station',
  'Thoth Station',
  'Tycho Station',
];

const randomBoolean = (truePercentage: number = 50): boolean =>
  Math.random() < truePercentage / 100;

const randomInteger = (min: number, max: number): number =>
  Math.round(Math.random() * (max - min) + min);

const randomItem = <T>(list: T[]) => list[randomInteger(0, list.length - 1)];

const referenceMap: Record<string, Record<string, { key: string; id: string }>> = {};

const generateRandomCategory = (nodePrefix: string): string =>
  new Array(randomInteger(1, CATEGORY_TREE_DEPTH))
    .fill(0)
    .map(() => `${nodePrefix}-${randomInteger(0, CATEGORY_TREE_CHILDREN_PER_NODE)}`)
    .join('/');

const generateUniqueCategories = (nodePrefix: string): string[] => {
  const categoryCount = randomInteger(MIN_CATEGORIES_PER_RESOURCE, MAX_CATEGORIES_PER_RESOURCE);
  const categorySet: Set<string> = new Set();
  while (categorySet.size < categoryCount) {
    const category = generateRandomCategory(nodePrefix);
    categorySet.add(category);
  }
  return [...categorySet];
};

const addOrLookupRef = async (
  key: string,
  value: string,
  accountSid: string,
): Promise<{ id: string; value: string }> => {
  referenceMap[accountSid] = referenceMap[accountSid] ?? {};
  referenceMap[accountSid][value] = referenceMap[accountSid][value] ?? { id: randomUUID(), key };
  return { value, id: referenceMap[accountSid][value].id };
};

const writeReferences = async (): Promise<void> => {
  const referenceList = Object.entries(referenceMap).flatMap(([accountSid, refs]) =>
    Object.entries(refs).map(([value, { id, key }]) => ({
      id,
      value,
      key,
      accountSid,
    })),
  );
  let counter = 0;
  while (counter < referenceList.length) {
    const end = Math.min(counter + REFERENCES_PER_FILE, referenceList.length);
    const fileName = `${counter}-${end}.json`;
    console.log('Writing reference file', fileName);
    const referenceFile = await fsPromises.open(`${ROOT_REFERENCE_DIRECTORY}/${fileName}`, 'w+');
    await referenceFile.writeFile(JSON.stringify(referenceList.slice(counter, end), null, 2));
    counter += REFERENCES_PER_FILE;
  }
};

async function main() {
  const [, , ...args] = process.argv;

  if (args.length !== 1) {
    console.error(`[---------- ERROR ----------] Usage: scraper <number_of_files>`);
    return;
  }
  console.log('Parsing arguments.');
  const maxNumberOfResources = Number.parseInt(args[0]);
  let resourcesWritten = 0;

  async function writeResourceFile(targetResourceFile: string): Promise<void> {
    console.log('Writing resource file', targetResourceFile);
    let fileResources = 0;
    const resourceFile = await fsPromises.open(targetResourceFile, 'w+');
    try {
      await resourceFile.writeFile('[');
      while (fileResources < RESOURCES_PER_FILE && resourcesWritten < maxNumberOfResources) {
        const accountSid = randomItem(ACCOUNT_SIDS);
        const referenceCategories = await Promise.all(
          generateUniqueCategories('reference-node').map(c =>
            addOrLookupRef('referenceCategories', c, accountSid),
          ),
        );
        try {
          if (fileResources) {
            await resourceFile.writeFile(',\r\n');
          }
          await resourceFile.writeFile(
            JSON.stringify(
              {
                id: randomUUID(),
                name: `Test Resource ${resourcesWritten}`,
                accountSid,
                attributes: {
                  inlineCategories: generateUniqueCategories('inline-node'),
                  referenceCategories,
                  created: new Date().toISOString(),
                  city: randomItem(CITIES),
                  postalCode: randomInteger(10000, 99999).toString(),
                  virtual: randomBoolean(),
                },
              },
              null,
              2,
            ),
          );
          resourcesWritten++;
          fileResources++;
          console.log(
            `Wrote ${resourcesWritten} / ${maxNumberOfResources} resources, ${fileResources} / ${RESOURCES_PER_FILE} in ${targetResourceFile}`,
          );
        } catch (err) {
          console.error(err);
        }
      }
    } finally {
      await resourceFile.writeFile(']');
      await resourceFile.close();
    }
  }

  try {
    console.log('Starting writing resources.');
    while (resourcesWritten < maxNumberOfResources) {
      // eslint-disable-next-line @typescript-eslint/no-loop-func
      const fileName = `${resourcesWritten}-${Math.min(
        resourcesWritten + RESOURCES_PER_FILE,
        maxNumberOfResources,
      )}.json`;
      await writeResourceFile(`${ROOT_RESOURCE_DIRECTORY}/${fileName}`);
    }
    console.log('Starting writing references.');
    await writeReferences();
  } catch (err) {
    console.error(`Error running script:`, err);
  }
}

main().catch(err => {
  throw err;
});

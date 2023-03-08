import * as fs from 'fs/promises';
import * as process from 'process';
import { mapKHPResource } from './khp-aselo-converter';
import { KHP_MAPPING_NODE } from './khp-mapping';
import { generateAseloReferenceSql, generateAseloResourceSql } from './generate-aselo-sql';
import { db } from '../src/connection-pool';

const loadSampleJson = async (): Promise<any[]> => {
  console.log(process.cwd());
  const sample = await fs.readFile('./resource-json/khp-sample.json', 'utf8');
  return JSON.parse(sample);
};

const main = async () => {
  const sample = await loadSampleJson();
  const onlyGenerateSql = process.argv[3] && process.argv[3].includes('only-generate-sql');
  const aseloResources = sample.map(sampleItem => mapKHPResource(KHP_MAPPING_NODE, sampleItem));
  await fs.writeFile(
    './resource-json/khp-sample-aselo.json',
    JSON.stringify(aseloResources, null, 2),
  );
  const referenceSql = generateAseloReferenceSql(process.argv[2]);
  await fs.writeFile('./resource-json/khp-sample-reference-data.sql', referenceSql);
  if (!onlyGenerateSql) {
    await db.multi(referenceSql);
  }

  for (const resource of aseloResources) {
    const resourceSql = generateAseloResourceSql(process.argv[2], resource);
    await fs.writeFile(`./resource-json/khp-sample-resource-data-${resource.id}.sql`, resourceSql);
    if (!onlyGenerateSql) {
      await db.multi(resourceSql);
    }
  }
};

main().catch(console.error);

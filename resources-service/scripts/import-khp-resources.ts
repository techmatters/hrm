import * as fs from 'fs/promises';
import * as process from 'process';
import { mapKHPResource } from './khp-aselo-converter';
import { KHP_MAPPING_NODE } from './khp-mapping';

const loadSampleJson = async (): Promise<any[]> => {
  console.log(process.cwd());
  const sample = await fs.readFile('./resource-json/khp-sample.json', 'utf8');
  return JSON.parse(sample);
};

const main = async () => {
  const sample = await loadSampleJson();
  const resources = sample.map(sampleItem => mapKHPResource(KHP_MAPPING_NODE, sampleItem));
  console.log(JSON.stringify(resources, null, 2));
};

main().catch(console.error);

/**
 * Copyright (C) 2021-2023 Technology Matters
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see https://www.gnu.org/licenses/.
 */

// eslint-disable-next-line import/no-extraneous-dependencies
import { parse } from 'csv-parse';
import fs from 'fs';
import { pgp } from '../../src/connection-pool';

const CANADIAN_PROVINCE_NAME_CODE_MAP = {
  Alberta: 'AB',
  'British Columbia': 'BC',
  Manitoba: 'MB',
  'New Brunswick': 'NB',
  'Newfoundland and Labrador': 'NL',
  'Northwest Territories': 'NT',
  'Nova Scotia': 'NS',
  Nunavut: 'NU',
  Ontario: 'ON',
  'Prince Edward Island': 'PE',
  Quebec: 'QC',
  Saskatchewan: 'SK',
  Yukon: 'YT',
} as const;

const CANADIAN_PROVINCE_CODE_FR_MAP = {
  AB: 'Alberta',
  BC: 'Colombie-Britannique',
  NL: 'Terre-Neuve-et-Labrador',
  PE: 'Île-du-Prince-Édouard',
  NS: 'Nouvelle-Écosse',
  NB: 'Nouveau-Brunswick',
  ON: 'Ontario',
  MB: 'Manitoba',
  SK: 'Saskatchewan',
  YT: 'Yukon',
  NT: 'Territoires du Nord-Ouest',
  NU: 'Nunavut',
  QC: 'Québec',
} as const;

const TARGET_FILE_PATH = './reference-data/khp_cities_20230612.sql';
const TARGET_JSON_CITIES_FILE_PATH = './reference-data/khp_cities_20230612.json';
const TARGET_JSON_PROVINCES_FILE_PATH = './reference-data/khp_provinces_20230612.json';
const main = async () => {
  if (process.argv.length < 3) {
    console.error('Usage: node importLocationsCsv.js <accountSid>');
    process.exit(1);
  }
  const sqlFile = fs.createWriteStream(TARGET_FILE_PATH);
  const provincesJson = [];
  const citiesJson = [];
  const csvLines = fs
    .createReadStream('./reference-data/khp_cities_20230612.csv')
    .pipe(parse({ fromLine: 2 }));
  sqlFile.write(`--- PROVINCES ---\n\n`);

  Object.entries(CANADIAN_PROVINCE_NAME_CODE_MAP).forEach(([name, code]) => {
    sqlFile.write(
      pgp.as.format(
        `
INSERT INTO resources."ResourceReferenceStringAttributeValues" ("accountSid", "list", "id", "value", "language", "info") VALUES ($<accountSid>, 'provinces', $<id>, $<value>, 'en', $<info>);
INSERT INTO resources."ResourceReferenceStringAttributeValues" ("accountSid", "list", "id", "value", "language", "info") VALUES ($<accountSid>, 'provinces', $<idFr>, $<value>, 'fr', $<infoFr>);`,
        {
          accountSid: process.argv[2],
          id: `CA-${code}-en`,
          idFr: `CA-${code}-fr`,
          value: `CA/${code}`,
          info: { name },
          infoFr: { name: CANADIAN_PROVINCE_CODE_FR_MAP[code] },
        },
      ),
    );
    provincesJson.push({
      label: name,
      value: `CA/${code}`,
    });
  });
  sqlFile.write('\n\n--- CITIES ---\n\n');
  for await (const line of csvLines) {
    const [cityEn, cityFr, , , province] = line as string[];
    const provinceCode =
      CANADIAN_PROVINCE_NAME_CODE_MAP[province as keyof typeof CANADIAN_PROVINCE_NAME_CODE_MAP];
    const sqlStatement = pgp.as.format(
      `
INSERT INTO resources."ResourceReferenceStringAttributeValues" ("accountSid", "list", "id", "value", "language", "info") VALUES ($<accountSid>, 'cities', $<id>, $<value>, 'en', $<info>);
INSERT INTO resources."ResourceReferenceStringAttributeValues" ("accountSid", "list", "id", "value", "language", "info") VALUES ($<accountSid>, 'cities', $<idFr>, $<value>, 'fr', $<infoFr>);`,
      {
        accountSid: process.argv[2],
        id: `CA-${provinceCode}-${cityEn}-en`,
        idFr: `CA-${provinceCode}-${cityEn}-fr`,
        value: `CA/${provinceCode}/${cityEn}`,
        info: { name: cityEn },
        infoFr: { name: cityFr },
      },
    );
    sqlFile.write(sqlStatement);
    citiesJson.push({
      label: cityEn,
      value: `CA/${provinceCode}/${cityEn}`,
    });
  }
  sqlFile.end();
  fs.writeFileSync(TARGET_JSON_CITIES_FILE_PATH, JSON.stringify(citiesJson, null, 2));
  fs.writeFileSync(TARGET_JSON_PROVINCES_FILE_PATH, JSON.stringify(provincesJson, null, 2));
};

main().catch(err => {
  console.error(err);
  process.exit(1);
});

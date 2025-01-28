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
import * as fs from 'fs';
import { pgp } from '../../src/connection-pool';

const CANADIAN_PROVINCE_CODE_EN_MAP = {
  AB: 'Alberta',
  BC: 'British Columbia',
  NL: 'Newfoundland and Labrador',
  PE: 'Île-du-Prince-Édouard',
  NS: 'Nouvelle-Écosse',
  NB: 'New Brunswick',
  ON: 'Ontario',
  MB: 'Manitoba',
  SK: 'Saskatchewan',
  YT: 'Yukon',
  NT: 'Northwest Territories',
  NU: 'Nunavut',
  QC: 'Québec',
} as const;
/*
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
*/

const main = async () => {
  if (process.argv.length < 3) {
    console.error('Usage: node importLocationsCsv.js <accountSid>');
    process.exit(1);
  }
  const accountSid = process.argv[2];
  const targetFilePath = `./reference-data/generated-sql/khp_cities_20250122_${accountSid}.sql`;
  const sqlFile = fs.createWriteStream(targetFilePath);

  const csvLines = fs
    .createReadStream('./reference-data/khp_cities_20250122.csv')
    .pipe(parse({ fromLine: 2 }));

  sqlFile.write('\n\n--- REGIONS AND CITIES ---\n\n');
  for await (const line of csvLines) {
    const [, provinceCode, region, cityEn] = line as string[];
    const provinceName =
      CANADIAN_PROVINCE_CODE_EN_MAP[
        provinceCode as keyof typeof CANADIAN_PROVINCE_CODE_EN_MAP
      ];
    if (!region || region.toLowerCase() === 'unknown') {
      console.info(`${cityEn} (${provinceName}) has no region, skipping`);
      continue;
    }

    const sqlStatements = [
      pgp.as.format(
        `
INSERT INTO resources."ResourceReferenceStringAttributeValues" ("accountSid", "list", "id", "value", "language", "info") VALUES ($<accountSid>, 'country/province/region', $<regionId>, $<regionValue>, 'en', $<regionInfo>)
ON CONFLICT DO NOTHING;
INSERT INTO resources."ResourceReferenceStringAttributeValues" ("accountSid", "list", "id", "value", "language", "info") VALUES ($<accountSid>, 'country/province/region', $<regionId>, $<regionValue>, 'fr', $<regionInfo>)
ON CONFLICT DO NOTHING;`,
        {
          accountSid: process.argv[2],
          regionId: `CA-${provinceCode}-${region}-en`,
          regionValue: `CA/${provinceCode}/${region}`,
          regionInfo: { name: region, province: provinceName },
        },
      ),
    ];
    if (cityEn) {
      sqlStatements.push(
        pgp.as.format(
          `
INSERT INTO resources."ResourceReferenceStringAttributeValues" ("accountSid", "list", "id", "value", "language", "info")
VALUES ($<accountSid>, 'country/province/region/city', $<id>, $<value>, 'en',
        $<info>) ON CONFLICT DO NOTHING;
INSERT INTO resources."ResourceReferenceStringAttributeValues" ("accountSid", "list", "id", "value", "language", "info")
VALUES ($<accountSid>, 'country/province/region/city', $<id>, $<value>, 'fr',
        $<info>) ON CONFLICT DO NOTHING;
              `,
          {
            accountSid: process.argv[2],
            id: `CA-${provinceCode}-${region}-${cityEn}-en`,
            value: `CA/${provinceCode}/${region}/${cityEn}`,
            info: { name: cityEn, region, province: provinceName },
          },
        ),
      );
    }
    sqlFile.write(sqlStatements.join('\n') + '\n');
  }
  sqlFile.end();
};

main().catch(err => {
  console.error(err);
  process.exit(1);
});

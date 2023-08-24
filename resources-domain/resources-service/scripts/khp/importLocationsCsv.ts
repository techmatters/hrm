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

const CANADIAN_PROVINCE_NAME_CODE_MAP = {
  Alberta: ['AB', 48],
  'British Columbia': ['BC', 59],
  Manitoba: ['MB', 46],
  'New Brunswick': ['NB', 13],
  'Newfoundland and Labrador': ['NL', 10],
  'Northwest Territories': ['NT', 61],
  'Nova Scotia': ['NS', 12],
  Nunavut: ['NU', 62],
  Ontario: ['ON', 35],
  'Prince Edward Island': ['PE', 11],
  Quebec: ['QC', 24],
  Saskatchewan: ['SK', 47],
  Yukon: ['YT', 60],
} as const;

type FilterOption = {
  value: string;
  label: string;
};

const main = async () => {
  if (process.argv.length < 3) {
    console.error('Usage: node importLocationsCsv.js <accountSid>');
    process.exit(1);
  }
  const accountSid = process.argv[2];
  const targetFilePath = `./reference-data/khp_cities_20230822_${accountSid}.sql`;
  const targetJsonCitiesFilePath = `./reference-data/khp_cities_20230822_${accountSid}.json`;
  const targetJsonProvincesFilePath = `./reference-data/khp_provinces_20230622_${accountSid}.json`;
  const sqlFile = fs.createWriteStream(targetFilePath);

  const provincesJson: FilterOption[] = [];
  const citiesJson: FilterOption[] = [];
  const csvLines = fs
    .createReadStream('./reference-data/khp_cities_20230822.csv')
    .pipe(parse({ fromLine: 2 }));
  sqlFile.write(`--- PROVINCES ---\n\n`);

  Object.entries(CANADIAN_PROVINCE_NAME_CODE_MAP).forEach(([name, [code]]) => {
    provincesJson.push({
      label: name,
      value: `CA/${code}`,
    });
  });
  sqlFile.write('\n\n--- CITIES ---\n\n');
  for await (const line of csvLines) {
    const [, province, , cityEn] = line as string[];
    const [provinceCode] =
      CANADIAN_PROVINCE_NAME_CODE_MAP[
        province as keyof typeof CANADIAN_PROVINCE_NAME_CODE_MAP
      ];
    citiesJson.push({
      label: cityEn,
      value: `CA/${provinceCode}/${cityEn}`,
    });
  }
  sqlFile.end();
  fs.writeFileSync(
    targetJsonCitiesFilePath,
    JSON.stringify(
      Object.values(Object.fromEntries(citiesJson.map(c => [c.value, c]))),
      null,
      2,
    ),
  );
  fs.writeFileSync(targetJsonProvincesFilePath, JSON.stringify(provincesJson, null, 2));
};

main().catch(err => {
  console.error(err);
  process.exit(1);
});

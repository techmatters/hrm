import csv from 'csv-parser';
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
};

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
};

const TARGET_FILE_PATH = './resource-json/khp_cities_20230612.sql';

const sqlFile = fs.createWriteStream(TARGET_FILE_PATH);
fs.createReadStream('./resource-json/khp_cities_20230612.csv')
  .pipe(
    csv({
      mapValues: ({
        value: {
          ['Province / territory, english']: province,
          ['Geographic name, english']: cityEn,
          ['Geographic name, french']: cityFr,
        },
      }) => {
        const provinceCode = CANADIAN_PROVINCE_NAME_CODE_MAP[province];
        return pgp.as.format(
          `
    INSERT INTO resources."ResourceReferenceStringAttributeValues" ("accountSid", "list", "id", "value", "language", "info") VALUES ('cities', $<id>, $<value>, "en", $<info>);\n
    INSERT INTO resources."ResourceReferenceStringAttributeValues" ("accountSid", "list", "id", "value", "language", "info") VALUES ('cities', $<idFr>, $<value>, "fr", $<infoFr>);\n`,
          {
            id: `CA-${provinceCode}-${cityEn}-en`,
            idFr: `CA-${provinceCode}-${cityEn}-fr`,
            value: `CA/${provinceCode}/${cityEn}`,
            info: { name: cityEn },
            infoFr: { name: cityFr },
          },
        );
      },
    }),
  )
  .pipe(sqlFile)
  .on('end', () => {});
fs.appendFileSync(
  TARGET_FILE_PATH,
  `--- PROVINCES ---\n\n
  ${Object.entries(CANADIAN_PROVINCE_NAME_CODE_MAP)
    .map(([name, code]) => {
      return pgp.as.format(
        `
    INSERT INTO resources."ResourceReferenceStringAttributeValues" ("accountSid", "list", "id", "value", "language", "info") VALUES ('provinces', $<id>, $<value>, "en", $<info>);\n
    INSERT INTO resources."ResourceReferenceStringAttributeValues" ("accountSid", "list", "id", "value", "language", "info") VALUES ('provinces', $<idFr>, $<value>, "fr", $<infoFr>);\n`,
        {
          id: `CA-${code}-en`,
          idFr: `CA-${code}-fr`,
          value: `CA/${code}`,
          info: { name },
          infoFr: { name: CANADIAN_PROVINCE_CODE_FR_MAP[code] },
        },
      );
    })
    .join('\n')}`,
);

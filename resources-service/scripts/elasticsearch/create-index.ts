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

import { getSsmParameter } from '@tech-matters/hrm-ssm-cache';
import { getClient } from '@tech-matters/elasticsearch-client';

const shortCode = process.argv[2] || 'as';

const addIndexIfNotExists = async () => {
  const accountSid = await getSsmParameter(
    `/${process.env.NODE_ENV}/twilio/${shortCode.toLocaleUpperCase()}/account_sid`,
  );

  const client = await getClient({ accountSid });

  const index = `${accountSid.toLowerCase()}-resources`;

  if (await client.indices.exists({ index })) {
    console.log(`Index for ${shortCode}already exists, skipping creation.`);
    return;
  }

  const body = await require(`./index-config/${shortCode}.js`).body;

  console.log(`Creating index for ${shortCode}...`);
  await client.indices.create({
    index,
    body,
  });
};

addIndexIfNotExists();

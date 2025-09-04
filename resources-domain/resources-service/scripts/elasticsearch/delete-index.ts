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

import { getClient } from '@tech-matters/elasticsearch-client';
import {
  RESOURCE_INDEX_TYPE,
  getResourceIndexConfiguration,
} from '@tech-matters/resources-search-config';
import { STS } from 'aws-sdk';

const shortCode = process.argv[2] || 'as';
const timestamp = new Date().getTime();
const assumeRoleParams = {
  RoleArn: 'arn:aws:iam::712893914485:role/tf-admin',
  RoleSessionName: `resource-admin-cli-${timestamp}`,
};

const sts = new STS();
sts
  .assumeRole(assumeRoleParams)
  .promise()
  .then(({ Credentials }) => {
    process.env.AWS_ACCESS_KEY_ID = Credentials!.AccessKeyId;
    process.env.AWS_SECRET_ACCESS_KEY = Credentials!.SecretAccessKey;
    process.env.AWS_SESSION_TOKEN = Credentials!.SessionToken;

    getClient({ shortCode, indexType: RESOURCE_INDEX_TYPE }).then(client => {
      const resourceIndexConfiguration = getResourceIndexConfiguration(shortCode);
      return client.indexClient(resourceIndexConfiguration).deleteIndex();
    });
  });

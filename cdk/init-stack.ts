#!/usr/bin/env node
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

/* eslint-disable no-new */
import * as cdk from '@aws-cdk/core';
import * as dotenv from 'dotenv';

import ContactCompleteStack from './contact-complete-stack';
import ContactCoreStack from './contact-core-stack';
import ContactRetrieveStack from './contact-retrieve-stack';
import LocalCoreStack from './local-core-stack';
import ResourcesCompleteStack from './resources-complete-stack';
import ResourcesCoreStack from './resources-core-stack';
import ResourcesJobsStack from './resources-jobs-stack';

dotenv.config({ path: './cdk/.env' });

/**
 * We use AWS-CDK to configure localstack because it is the most common example
 * found of using localstack for locally testing lambda/sqs interactions. It also
 * provides some fairly easy tools for creating lambda functions based on local TS code.
 *
 * This requires duplicating the entire infrastructure stack definition in both CDK and
 * terraform.
 *
 * An alternative approach would be to use terraform as the IaC tool for both
 * localstack and AWS. This would allow us to use the same terraform modules
 * for both and would likely allow us to tightly couple the infrastructure definition
 * with the code in this repo. It would also allow us to test terraform modules locally.
 *
 * (rbd 14-10-22)
 */

const app = new cdk.App();

new LocalCoreStack({
  scope: app,
  id: 'local-core',
  props: {
    env: { region: app.node.tryGetContext('region') },
  },
});

const contactCore = new ContactCoreStack({
  scope: app,
  id: 'contact-core',
  props: {
    env: { region: app.node.tryGetContext('region') },
  },
});

const contactComplete = new ContactCompleteStack({
  scope: app,
  id: 'contact-complete',
  params: {
    skipLambda: true, // for now the lambda to process complete queue is disabled
  },
  props: {
    env: { region: app.node.tryGetContext('region') },
  },
});

new ContactRetrieveStack({
  scope: app,
  id: 'retrieve-transcript',
  params: {
    completeQueue: contactComplete.completeQueue,
    docsBucket: contactCore.docsBucket,
  },
  props: {
    env: { region: app.node.tryGetContext('region') },
  },
});

new ContactRetrieveStack({
  scope: app,
  id: 'retrieve-recording-url',
  params: {
    completeQueue: contactComplete.completeQueue,
    docsBucket: contactCore.docsBucket,
  },
  props: {
    env: { region: app.node.tryGetContext('region') },
  },
});

new ResourcesCoreStack({
  scope: app,
  id: 'resources-core',
  props: {
    env: { region: app.node.tryGetContext('region') },
  },
});

const resourcesSearchIndexComplete = new ResourcesCompleteStack({
  scope: app,
  id: 'search-index-complete',
  params: {
    skipLambda: false,
  },
  props: {
    env: { region: app.node.tryGetContext('region') },
  },
});

new ResourcesJobsStack({
  scope: app,
  id: 'search-index',
  params: {
    completeQueue: resourcesSearchIndexComplete.completeQueue,
  },
  props: {
    env: { region: app.node.tryGetContext('region') },
  },
});

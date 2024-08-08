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
import { App } from 'aws-cdk-lib';
import * as dotenv from 'dotenv';

import ContactCompleteStack from './contact-complete-stack';
import ContactCoreStack from './contact-core-stack';
import ContactTranscriptJobStack from './contact-transcript-job-stack';
import HrmMicoservicesStack from './hrm-micoroservices-stack';
import LocalCoreStack from './local-core-stack';
import ResourcesCoreStack from './resources-core-stack';
import ResourcesSearchCompleteStack from './resources-search-complete-stack';
import ResourcesSearchJobsStack from './resources-search-jobs-stack';
import downloadAssets from './download-assets';
dotenv.config({ path: './cdk/.env' });

const accountSids = [
  process.env.TWILIO_ACCOUNT_SID || 'mockAccountSid',
  'mockAccountSid1',
  'testSid1',
  'testSid2',
];

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

async function main() {
  const assets = await downloadAssets({ accountSids });
  const app = new App();

  const localCore = new LocalCoreStack({
    scope: app,
    id: 'local-core',
    params: {
      accountSids,
      assets,
    },
    props: {
      env: { region: app.node.tryGetContext('region') },
    },
  });

  new ContactCoreStack({
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

  new ContactTranscriptJobStack({
    scope: app,
    id: 'retrieve-transcript',
    params: {
      completeQueue: contactComplete.completeQueue,
      docsBucket: localCore.docsBucket,
    },
    props: {
      env: { region: app.node.tryGetContext('region') },
    },
  });

  new ContactTranscriptJobStack({
    scope: app,
    id: 'scrub-transcript',
    params: {
      completeQueue: contactComplete.completeQueue,
      docsBucket: localCore.docsBucket,
      skipLambda: true,
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

  const resourcesSearchIndexComplete = new ResourcesSearchCompleteStack({
    scope: app,
    id: 'search-complete',
    params: {
      skipLambda: false,
    },
    props: {
      env: { region: app.node.tryGetContext('region') },
    },
  });

  new ResourcesSearchJobsStack({
    scope: app,
    id: 'search-index',
    params: {
      completeQueue: resourcesSearchIndexComplete.completeQueue,
    },
    props: {
      env: { region: app.node.tryGetContext('region') },
    },
  });

  new HrmMicoservicesStack({
    scope: app,
    id: 'hrm-microservices',
    props: {
      env: { region: app.node.tryGetContext('region') },
    },
  });
}

main();

#!/usr/bin/env node
/* eslint-disable no-new */
import * as cdk from '@aws-cdk/core';
import ContactCompleteStack from './contact-complete-stack';
import ContactCoreStack from './contact-core-stack';
import ContactRetrieveStack from './contact-retrieve-stack';

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
 * Another alternative would be to use CDK for both localstack and AWS. This would
 * prevent the duplication of infrastructure definitions, but is yet another layer of
 * complexity to learn and maintain and lean on for our production stack.
 *
 * (rbd 14-10-22)
 */

const app = new cdk.App();

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
  id: 'contact-retrieve-transcript',
  params: {
    completeQueue: contactComplete.completeQueue,
    docsBucket: contactCore.docsBucket,
    skipLambda: true, // for now the lambda to process complete queue is disabled
  },
  props: {
    env: { region: app.node.tryGetContext('region') },
  },
});

new ContactRetrieveStack({
  scope: app,
  id: 'contact-retrieve-recording-url',
  params: {
    completeQueue: contactComplete.completeQueue,
    docsBucket: contactCore.docsBucket,
    skipLambda: true, // for now the lambda to process complete queue is disabled
  },
  props: {
    env: { region: app.node.tryGetContext('region') },
  },
});

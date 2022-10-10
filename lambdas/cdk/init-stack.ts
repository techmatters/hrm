#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import { ContactCompleteStack } from './contact-complete-stack';
import { ContactCoreStack } from './contact-core-stack';
import { ContactRetrieveStack } from './contact-retrieve-stack';

/**
 * Discussion:
 *
 * I used AWS-CDK to setup localstack because it seemed to be the most common example
 * I could find of using localstack for locally testing lambda/sqs interactions.
 * It also provides some fairly easy tools for creating lambda functions based
 * on local TS code.
 *
 * As you can see, this basically requires duplicating the entire infrastructure stack
 * definition in both CDK and terraform. This seems like a lot of
 * duplication and maintenance overhead. It isn't *that* uncommon in my experience to
 * have a local dev env defined in docker-compose or similar, and then a deployable env
 * defined in terraform. But I thought I would mention that the localstack setup could
 * potentially allow us to avoid that duplication with some well modularized IaC.
 *
 * An alternative approach would be to use terraform as the IaC tool for both
 * localstack and AWS. This would allow us to use the same terraform modules
 * for both and would likely allow us to tightly couple the infrastructure definition
 * with the code in this repo. It would take a bit of work to get this up and running
 * and it is fairly complex. I do have some general ideas around what this setup could
 * look like that I'm happy to explore with the team if you think it is worthwhile.
 *
 * Another alternative would be to use CDK for both localstack and AWS. This would
 * prevent the duplication of infrastructure definitions, but is yet another layer of
 * complexity to learn and maintain and lean on for our production stack.
 *
 * I'm not sure if either of these approaches would be worth the effort at this point.
 * (rbd 09-10-22)
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
  },
  props: {
    env: { region: app.node.tryGetContext('region') },
  },
});

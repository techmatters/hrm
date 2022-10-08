#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import { ContactCompleteStack } from './contact-complete-stack';
import { ContactCoreStack } from './contact-core-stack';
import { ContactRetrieveStack } from './contact-retrieve-stack';

const app = new cdk.App();
const contactCore = new ContactCoreStack(app, 'ContactCoreStack', {
  env: { region: app.node.tryGetContext('region') },
});

const contactComplete = new ContactCompleteStack(app, 'contact-complete', {
  env: { region: app.node.tryGetContext('region') },
});

new ContactRetrieveStack(
  app,
  'contact-retrieve-transcript',
  {
    deadLetterQueue: contactComplete.completeQueue,
    completeQueue: contactComplete.completeQueue,
    docsBucket: contactCore.docsBucket,
  },
  {
    env: { region: app.node.tryGetContext('region') },
  },
);

new ContactRetrieveStack(
  app,
  'contact-retrieve-recording-url',
  {
    deadLetterQueue: contactComplete.completeQueue,
    completeQueue: contactComplete.completeQueue,
    docsBucket: contactCore.docsBucket,
  },
  {
    env: { region: app.node.tryGetContext('region') },
  },
);

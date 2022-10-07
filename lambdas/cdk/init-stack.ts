#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import { ContactCoreStack } from './contact-core-stack';
import { ContactRetrieveStack } from './contact-retrieve-stack';

const app = new cdk.App();
const contactCore = new ContactCoreStack(app, 'ContactCoreStack', {
  env: { region: app.node.tryGetContext('region') },
});

const contactRetriveTranscript = new ContactRetrieveStack(
  app,
  'contact-retrieve-transcript',
  {
    deadLetterQueue: contactCore.completeQueue,
    completeQueue: contactCore.completeQueue,
    docsBucket: contactCore.docsBucket,
  },
  {
    env: { region: app.node.tryGetContext('region') },
  },
);

// new ContactRetrieveStack(
//   app,
//   'contact-retrieve-recording-url',
//   {
//     deadLetterQueue: contactCore.completeQueue,
//   },
//   {
//     env: { region: app.node.tryGetContext('region') },
//   },
// );

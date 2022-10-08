import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
import * as lambdaNode from '@aws-cdk/aws-lambda-nodejs';
import * as sqs from '@aws-cdk/aws-sqs';
import { SqsEventSource } from '@aws-cdk/aws-lambda-event-sources';

export class ContactCompleteStack extends cdk.Stack {
  public readonly completeQueue: sqs.Queue;

  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    this.completeQueue = new sqs.Queue(this, 'contact-complete');

    new cdk.CfnOutput(this, 'queueUrl', {
      value: this.completeQueue.queueUrl,
      description: 'The url of the complete queue',
    });

    const fn = new lambdaNode.NodejsFunction(this, 'fetchParams', {
      //TODO: change this back to 16 once it isn't broken upstream
      runtime: lambda.Runtime.NODEJS_16_X,
      memorySize: 512,
      handler: 'handler',
      entry: `./src/contact-complete/index.ts`,
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
        AWS_ENDPOINT_OVERRIDE: 'http://localstack:4566',
        SQS_ENDPOINT: 'http://localstack:4566',
      },
      bundling: { sourceMap: true },
    });

    fn.addEventSource(
      new SqsEventSource(this.completeQueue, { batchSize: 10, reportBatchItemFailures: true }),
    );
  }
}

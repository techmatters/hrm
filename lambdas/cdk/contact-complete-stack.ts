import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
import * as lambdaNode from '@aws-cdk/aws-lambda-nodejs';
import * as sqs from '@aws-cdk/aws-sqs';
import { SqsEventSource } from '@aws-cdk/aws-lambda-event-sources';

/**
 * Discussion:
 *
 * I used AWS-CDK to setup localstack because it seemed to be the most common example
 * I could find of using localstack for locally testing lambda/sqs interactions.
 * It also provides some fairly easy tools for creating lambda functions based
 * on local nodejs code.
 *
 * As you can see, it basically requires duplicating the entire infrastructure stack
 * definition in both CDK and terraform in our current setup. This seems like a lot of
 * duplication and maintenance overhead.
 *
 * An alternative approach would be to use terraform as the IaC tool for both
 * localstack and AWS. This would allow us to use the same terraform modules
 * for both and would likely allow us to tightly couple the infrastructure definition
 * with the code in this repo. It would take a bit of work to get this up and running
 * and it is fairly complex. I do have some general ideas around what this setup could
 * look like that I'm happy to explore with the team if you think it is worthwhile.
 *
 * An alternative alternative would be to use CDK for both localstack and AWS. This would
 * prevent the duplication of infrastructure definitions, but is yet another layer of
 * complexity to learn and maintain and lean on for our production stack. I'm not sure if
 * either of these approaches would be worth the effort at this point. (rbd 09-10-22)
 */

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

import * as cdk from '@aws-cdk/core';
import * as iam from '@aws-cdk/aws-iam';
import * as lambda from '@aws-cdk/aws-lambda';
import * as lambdaNode from '@aws-cdk/aws-lambda-nodejs';
import * as s3 from '@aws-cdk/aws-s3';
import * as sqs from '@aws-cdk/aws-sqs';
import { SqsEventSource } from '@aws-cdk/aws-lambda-event-sources';

export class ContactRetrieveStack extends cdk.Stack {
  constructor(
    scope: cdk.Construct,
    id: string,
    resources: {
      completeQueue: sqs.Queue;
      deadLetterQueue: sqs.Queue;
      docsBucket: s3.Bucket;
    },
    props?: cdk.StackProps,
  ) {
    super(scope, id, props);

    const queue = new sqs.Queue(this, id);

    new cdk.CfnOutput(this, `queueUrl`, {
      value: queue.queueUrl,
      description: `The url of the ${id} queue`,
    });

    /*
      Here, there be dragons.
      This is very overcomplicated and took way too long to figure out.
      Tokens are unresolved until apply in the produced CF template.
      So, you can't just do normal string replace operations. You have
      to use native cloudformation functions to manipulate the string.
      BUUUT. There is no "replace" function in cloudformation. So you have
      to use split/join to do a janky replace. Also... for some reason we
      can't use "Fn::split" inside of a "Fn::Join" function directly. we have
      to use the select to iterate over items in the split or else we just
      get a string of "Fn::split" as our url. I have no idea why, but i
      discovered the pattern by trial and error mixed with reviewing generate
      cloudformation templates from the CDK that used the join/split replace
      pattern. (rbd 08/10/22)
    */
    const splitCompleteQueueUrl = cdk.Fn.split('localhost', resources.completeQueue.queueUrl);
    const completedQueueUrl = cdk.Fn.join('localstack', [
      cdk.Fn.select(0, splitCompleteQueueUrl),
      cdk.Fn.select(1, splitCompleteQueueUrl),
    ]);

    const fn = new lambdaNode.NodejsFunction(this, 'fetchParams', {
      //TODO: change this back to 16 once it isn't broken upstream
      runtime: lambda.Runtime.NODEJS_16_X,
      memorySize: 512,
      handler: 'handler',
      entry: `./src/${id}/index.ts`,
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
        AWS_ENDPOINT_OVERRIDE: 'http://localstack:4566',
        SQS_ENDPOINT: 'http://localstack:4566',
        hrm_env: 'local',
        completed_sqs_queue_url: completedQueueUrl,
      },
      bundling: { sourceMap: true },
      deadLetterQueueEnabled: true,
      deadLetterQueue: resources.deadLetterQueue,
    });

    fn.addEventSource(new SqsEventSource(queue, { batchSize: 10, reportBatchItemFailures: true }));

    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ssm:GetParametersByPath'],
        resources: [`arn:aws:ssm:${this.region}:*:parameter/local/*`],
      }),
    );

    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          's3:PutObject',
          's3:PutObjectAcl',
          's3:GetObject',
          's3:GetObjectAcl',
          's3:DeleteObject',
        ],
        resources: [resources.docsBucket.bucketArn],
      }),
    );
  }
}

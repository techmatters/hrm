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

    const completedSqsQueueImport = cdk.Fn.importValue('contactCompleteQueueUrl');

    const fn = new lambdaNode.NodejsFunction(this, 'fetchParams', {
      //   logRetention: logs.RetentionDays.ONE_WEEK,
      runtime: lambda.Runtime.NODEJS_16_X,
      memorySize: 512,
      handler: 'handler',
      entry: `./src/${id}/index.ts`,
      //   architectures: [lambda.Architecture.ARM_64],
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
        AWS_ENDPOINT_OVERRIDE: 'http://localstack:4566',
        SQS_ENDPOINT: 'http://localstack:4566',
        hrm_env: 'local',
        completed_sqs_queue_url: completedSqsQueueImport
          .toString()
          .replace(/localhost/g, 'localstack'),
      },
      bundling: { sourceMap: true },
      deadLetterQueueEnabled: true,
      deadLetterQueue: resources.deadLetterQueue,
    });

    fn.addEventSource(new SqsEventSource(queue, { batchSize: 10, reportBatchItemFailures: true }));

    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ssm:GetParametersByPath'],
        resources: [`arn:aws:ssm:${this.region}:*:parameter/local*`],
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

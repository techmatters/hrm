import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
import * as lambdaNode from '@aws-cdk/aws-lambda-nodejs';
import * as s3 from '@aws-cdk/aws-s3';
import * as sqs from '@aws-cdk/aws-sqs';
import * as ssm from '@aws-cdk/aws-ssm';
import { SqsEventSource } from '@aws-cdk/aws-lambda-event-sources';

export class ContactCoreStack extends cdk.Stack {
  public readonly docsBucket: s3.Bucket;
  public readonly completeQueue: sqs.Queue;

  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // create complete queue
    this.completeQueue = new sqs.Queue(this, 'contact-complete');

    new cdk.CfnOutput(this, 'contactCompleteQueueUrl', {
      value: this.completeQueue.queueUrl,
      description: 'The url of the complete queue',
      exportName: 'contactCompleteQueueUrl',
    });

    const fn = new lambdaNode.NodejsFunction(this, 'fetchParams', {
      //TODO: change this back to 16 once it isn't broken upstream
      runtime: lambda.Runtime.NODEJS_14_X,
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

    fn.addEventSource(new SqsEventSource(this.completeQueue, { batchSize: 1 }));

    this.docsBucket = new s3.Bucket(this, 'contact_docs_bucket', {
      bucketName: 'contact-docs-bucket',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    new ssm.StringParameter(this, 's3_testSid1_docs_bucket_name', {
      parameterName: '/local/s3/testSid1/docs_bucket_name',
      stringValue: this.docsBucket.bucketName,
    });

    new ssm.StringParameter(this, 's3_testSid2_docs_bucket_name', {
      parameterName: '/local/s3/testSid2/docs_bucket_name',
      stringValue: this.docsBucket.bucketName,
    });

    new ssm.StringParameter(this, 'twilio_testSid1_auth_token', {
      parameterName: '/local/twilio/testSid1/auth_token',
      stringValue: 'fakeAuthToken',
    });

    new ssm.StringParameter(this, 'twilio_testSid2_auth_token', {
      parameterName: '/local/twilio/testSid2/auth_token',
      stringValue: 'fakeAuthToken',
    });
  }
}

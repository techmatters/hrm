/* eslint-disable no-new */
import * as cdk from '@aws-cdk/core';
import * as s3 from '@aws-cdk/aws-s3';
import * as ssm from '@aws-cdk/aws-ssm';

export default class ContactCoreStack extends cdk.Stack {
  public readonly docsBucket: s3.Bucket;

  constructor({ scope, id, props }: { scope: cdk.App; id: string; props?: cdk.StackProps }) {
    super(scope, id, props);

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
      stringValue: 'mockAuthToken',
    });

    new ssm.StringParameter(this, 'twilio_testSid2_auth_token', {
      parameterName: '/local/twilio/testSid2/auth_token',
      stringValue: 'mockAuthToken',
    });

    new ssm.StringParameter(this, 'twilio_dev_user_sid', {
      parameterName: `/local/twilio/${process.env.TWILIO_ACCOUNT_SID}/auth_token`,
      stringValue: `${process.env.TWILIO_AUTH_TOKEN}`,
    });

    new ssm.StringParameter(this, 's3_dev_user_docs_bucket_name', {
      parameterName: `/local/s3/${process.env.TWILIO_ACCOUNT_SID}/docs_bucket_name`,
      stringValue: this.docsBucket.bucketName,
    });
  }
}

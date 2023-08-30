/**
 * Copyright (C) 2021-2023 Technology Matters
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see https://www.gnu.org/licenses/.
 */

/* eslint-disable no-new */
import * as cdk from 'aws-cdk-lib';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';

export default class ContactCompleteStack extends cdk.Stack {
  public readonly completeQueue: cdk.aws_sqs.Queue;

  constructor({
    scope,
    id,
    params = {
      skipLambda: false,
    },
    props,
  }: {
    scope: cdk.App;
    id: string;
    params?: {
      skipLambda: boolean;
    };
    props?: cdk.StackProps;
  }) {
    super(scope, id, props);
    this.completeQueue = new cdk.aws_sqs.Queue(this, id);

    new cdk.aws_ssm.StringParameter(this, `complete-queue-url`, {
      parameterName: `/local/us-east-1/sqs/jobs/contact/queue-url-complete`,
      stringValue: this.completeQueue.queueUrl,
    });

    // duplicated for test env
    new cdk.aws_ssm.StringParameter(this, `complete-queue-url-test`, {
      parameterName: `/test/us-east-1/sqs/jobs/contact/queue-url-complete`,
      stringValue: this.completeQueue.queueUrl,
    });

    new cdk.CfnOutput(this, 'queueUrl', {
      value: this.completeQueue.queueUrl,
      description: 'The url of the complete queue',
    });

    if (params.skipLambda) return;

    const fn = new NodejsFunction(this, 'fetchParams', {
      // TODO: change this back to 18 once it isn't broken upstream
      runtime: cdk.aws_lambda.Runtime.NODEJS_16_X,
      memorySize: 512,
      timeout: cdk.Duration.seconds(10),
      handler: 'handler',
      entry: `./hrm-domain/lambdas/${id}/index.ts`,
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
        S3_ENDPOINT: 'http://localstack:4566',
        S3_FORCE_PATH_STYLE: 'true',
        S3_REGION: 'us-east-1',
        SSM_ENDPOINT: 'http://localstack:4566',
        SQS_ENDPOINT: 'http://localstack:4566',
      },
      bundling: { sourceMap: true },
    });

    fn.addEventSource(
      new SqsEventSource(this.completeQueue, {
        batchSize: 10,
        reportBatchItemFailures: true,
      }),
    );
  }
}

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
import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
import * as lambdaNode from '@aws-cdk/aws-lambda-nodejs';
import * as sqs from '@aws-cdk/aws-sqs';
import * as ssm from '@aws-cdk/aws-ssm';
import { SqsEventSource } from '@aws-cdk/aws-lambda-event-sources';

export default class ContactCompleteStack extends cdk.Stack {
  public readonly completeQueue: sqs.Queue;

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
    this.completeQueue = new sqs.Queue(this, id);

    new ssm.StringParameter(this, `complete-queue-url`, {
      parameterName: `/local/us-east-1/sqs/jobs/contact/queue-url-complete`,
      stringValue: this.completeQueue.queueUrl,
    });

    // duplicated for test env
    new ssm.StringParameter(this, `complete-queue-url-test`, {
      parameterName: `/test/us-east-1/sqs/jobs/contact/queue-url-complete`,
      stringValue: this.completeQueue.queueUrl,
    });

    new cdk.CfnOutput(this, 'queueUrl', {
      value: this.completeQueue.queueUrl,
      description: 'The url of the complete queue',
    });

    if (params.skipLambda) return;

    const fn = new lambdaNode.NodejsFunction(this, 'fetchParams', {
      runtime: lambda.Runtime.NODEJS_16_X,
      memorySize: 512,
      timeout: cdk.Duration.seconds(10),
      handler: 'handler',
      entry: `./hrm-domain/${id}/index.ts`,
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
        S3_ENDPOINT: 'http://localstack:4566',
        S3_FORCE_PATH_STYLE: 'true',
        S3_REGION: 'us-east-1',
        SSM_ENDPOINT: 'http://localstack:4566',
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

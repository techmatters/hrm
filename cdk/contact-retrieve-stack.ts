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
import * as iam from '@aws-cdk/aws-iam';
import * as lambda from '@aws-cdk/aws-lambda';
import * as lambdaNode from '@aws-cdk/aws-lambda-nodejs';
import * as s3 from '@aws-cdk/aws-s3';
import * as sqs from '@aws-cdk/aws-sqs';
import * as ssm from '@aws-cdk/aws-ssm';
import { SqsEventSource } from '@aws-cdk/aws-lambda-event-sources';

export default class ContactRetrieveStack extends cdk.Stack {
  constructor({
    scope,
    id,
    params = {
      skipLambda: false,
    },
    props,
  }: {
    scope: cdk.Construct;
    id: string;
    params: {
      completeQueue: sqs.Queue;
      docsBucket: s3.Bucket;
      skipLambda?: boolean;
    };
    props?: cdk.StackProps;
  }) {
    super(scope, id, props);

    const queue = new sqs.Queue(this, id, {
      deadLetterQueue: { maxReceiveCount: 1, queue: params.completeQueue },
    });

    new cdk.CfnOutput(this, `queueUrl`, {
      value: queue.queueUrl,
      description: `The url of the ${id} queue`,
    });

    new ssm.StringParameter(this, `${id}-queue-url`, {
      parameterName: `/local/us-east-1/sqs/jobs/contact/queue-url-${id}`,
      stringValue: queue.queueUrl,
    });

    // duplicated for test env
    new ssm.StringParameter(this, `${id}-queue-url-test`, {
      parameterName: `/test/us-east-1/sqs/jobs/contact/queue-url-${id}`,
      stringValue: queue.queueUrl,
    });

    if (params.skipLambda) return;

    /*
      Here, there be dragons.

      To use the queue urls from inside of a lambda, we have to replace
      'localhost' with 'localstack' so that container to container dns
      lookups resolve correctly on the docker network.

      This is WAY more complicated than it should be and took way too long
      to figure out. But here goes:

      CDK passes around tokens that are used inside of the final CloudFormation
      template that is generated and deployed, not the actual string values for
      things like queue urls that aren't known until the deployment is partially
      complete.

      Tokens are unresolvable until they are applied in the produced CF template.
      So, you can't just do normal string replace operations. You have to use
      native cloudformation functions to manipulate the string.

      BUUUT. There is no "replace" function in cloudformation. So you have
      to use split/join to do a janky replace.

      Also... for some reason we can't use "Fn::split" inside of a "Fn::Join"
      function directly. We have to use the select to iterate over items in the
      split or else we just get a string of "Fn::split" as our url. I have no idea
      why, but i discovered this working pattern by trial and error mixed with reviewing
      generate cloudformation templates from the CDK that used the join/split replace
      pattern.

      This is pretty fragile since we can't arbitrarily split/join if there are
      multiple instances of the needle in the haystack. But it works for this
      simple case.
      (rbd 08/10/22)
    */
    const splitCompleteQueueUrl = cdk.Fn.split(
      'localhost',
      params.completeQueue.queueUrl,
    );
    const completedQueueUrl = cdk.Fn.join('localstack', [
      cdk.Fn.select(0, splitCompleteQueueUrl),
      cdk.Fn.select(1, splitCompleteQueueUrl),
    ]);

    const fn = new lambdaNode.NodejsFunction(this, 'fetchParams', {
      // TODO: change this back to 16 once it isn't broken upstream
      runtime: lambda.Runtime.NODEJS_16_X,
      memorySize: 512,
      handler: 'handler',
      entry: `./hrm-domain/contact-${id}/index.ts`,
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
        S3_ENDPOINT: 'http://localstack:4566',
        S3_FORCE_PATH_STYLE: 'true',
        S3_REGION: 'us-east-1',
        SSM_ENDPOINT: 'http://localstack:4566',
        SQS_ENDPOINT: 'http://localstack:4566',
        NODE_ENV: 'local',
        completed_sqs_queue_url: completedQueueUrl,
      },
      bundling: { sourceMap: true },
      deadLetterQueueEnabled: true,
      deadLetterQueue: params.completeQueue,
    });

    fn.addEventSource(
      new SqsEventSource(queue, { batchSize: 10, reportBatchItemFailures: true }),
    );

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
        resources: [params.docsBucket.bucketArn],
      }),
    );
  }
}

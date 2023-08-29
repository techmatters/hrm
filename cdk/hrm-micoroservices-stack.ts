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

import * as cdk from 'aws-cdk-lib';
import * as lambdaNode from 'aws-cdk-lib/aws-lambda-nodejs';

export default class HrmMicoservicesStack extends cdk.Stack {
  // Your existing class members here

  constructor({
    scope,
    id,
    props,
  }: {
    scope: cdk.App;
    id: string;
    props?: cdk.StackProps;
  }) {
    super(scope, id, props);

    const api = new cdk.aws_apigateway.RestApi(this, 'hrmMicroservicesApi', {
      restApiName: 'HRM Microservices',
    });

    new cdk.CfnOutput(this, 'apiUrl', {
      value: api.url,
      description: 'The url of the HRM Microservices API',
    });

    const v0 = api.root.addResource('v0');
    const accounts = v0.addResource('accounts');
    const accountProxy = accounts.addResource('{account_id}');

    const filesUrlsLambda = new lambdaNode.NodejsFunction(this, 'filesUrls', {
      runtime: cdk.aws_lambda.Runtime.NODEJS_18_X,
      memorySize: 512,
      timeout: cdk.Duration.seconds(10),
      handler: 'handler',
      entry: `./hrm-domain/lambdas/files-urls/index.ts`,
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
        S3_ENDPOINT: 'http://localstack:4566',
        S3_FORCE_PATH_STYLE: 'true',
        S3_REGION: 'us-east-1',
        SSM_ENDPOINT: 'http://localstack:4566',
        SNS_ENDPOINT: 'http://localstack:4566',
        SQS_ENDPOINT: 'http://localstack:4566',
        NODE_ENV: 'local',
        HRM_BASE_URL: 'http://host.docker.internal:8080',
      },
      bundling: { sourceMap: true },
    });

    const files = accountProxy.addResource('files');
    const urls = files.addResource('urls');

    urls.addMethod('GET', new cdk.aws_apigateway.LambdaIntegration(filesUrlsLambda));
  }
}

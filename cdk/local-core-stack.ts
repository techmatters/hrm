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

import { Assets } from './download-assets';

export default class LocalCoreStack extends cdk.Stack {
  public readonly docsBucket: s3.Bucket;

  constructor({
    scope,
    id,
    params,
    props,
  }: {
    scope: cdk.App;
    id: string;
    params: {
      assets: Assets;
      accountSids: string[];
    };
    props?: cdk.StackProps;
  }) {
    super(scope, id, props);

    const { accountSids } = params;

    new cdk.aws_ssm.StringParameter(this, 'account_sid_as', {
      parameterName: `/local/twilio/AS/account_sid`,
      stringValue: process.env.TWILIO_ACCOUNT_SID || 'mockAccountSid',
    });

    this.docsBucket = new cdk.aws_s3.Bucket(this, 'docs_bucket', {
      bucketName: 'docs-bucket',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    new cdk.aws_s3.Bucket(this, 'mock_bucket', {
      bucketName: 'mock-bucket',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    accountSids.forEach(accountSid => {
      new cdk.aws_ssm.StringParameter(this, `account_sid_${accountSid}`, {
        parameterName: `/local/twilio/${accountSid}/account_sid`,
        stringValue: accountSid,
      });

      new cdk.aws_ssm.StringParameter(this, `s3_docs_bucket_name_${accountSid}`, {
        parameterName: `/local/s3/${accountSid}/docs_bucket_name`,
        stringValue: this.docsBucket.bucketName,
      });
    });
  }
}

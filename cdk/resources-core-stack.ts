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

export default class ResourcesCoreStack extends cdk.Stack {
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

    const elasticsearchConfig = JSON.stringify({
      node: 'http://elasticsearch:9200',
    });

    new cdk.aws_ssm.StringParameter(this, 'resources_local_es_host', {
      parameterName: `/local/resources/us-east-1/elasticsearch_config`,
      stringValue: elasticsearchConfig,
    });

    new cdk.aws_ssm.StringParameter(this, 'resources_test_es_host', {
      parameterName: `/test/resources/us-east-1/elasticsearch_config`,
      stringValue: elasticsearchConfig,
    });
  }
}

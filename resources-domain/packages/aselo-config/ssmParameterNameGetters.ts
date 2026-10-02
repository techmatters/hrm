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

const getDefaultRegion = () => process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION;

export const getResourcesSearchIndexQueueUrlSsmPath = ({
  environment = process.env.NODE_ENV,
  region = getDefaultRegion(),
}: {
  environment?: string;
  region?: string;
}) => `/${environment}/${region}/sqs/jobs/hrm-resources-search/queue-url-index`;

export const getTwilioShortHelplineSsmPath = ({
  accountSid,
  environment = process.env.NODE_ENV,
}: {
  accountSid: string;
  environment?: string;
}) => `/${environment}/twilio/${accountSid}/short_helpline`;

export const getResourcesImportApiBaseUrlSsmPath = ({
  accountSid,
  environment = process.env.NODE_ENV,
}: {
  accountSid: string;
  environment?: string;
}) => `/${environment}/resources/${accountSid}/import_api/base_url`;

export const getResourcesImportApiKeySsmPath = ({
  accountSid,
  environment = process.env.NODE_ENV,
}: {
  accountSid: string;
  environment?: string;
}) => `/${environment}/resources/${accountSid}/import_api/api_key`;

export const getResourcesImportApiAuthHeaderSsmPath = ({
  accountSid,
  environment = process.env.NODE_ENV,
}: {
  accountSid: string;
  environment?: string;
}) => `/${environment}/resources/${accountSid}/import_api/auth_header`;

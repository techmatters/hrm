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

import { sendSqsMessage } from '@tech-matters/sqs-client';
import { getSsmParameter } from '../../config/ssmCache';
import { IndexMessage } from '@tech-matters/hrm-search-config';
import { CaseService, Contact } from '@tech-matters/hrm-types';
import { AccountSID } from '@tech-matters/types';

const PENDING_INDEX_QUEUE_SSM_PATH = `/${process.env.NODE_ENV}/${
  process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION
}/sqs/jobs/hrm-search-index/queue-url-consumer`;

const publishToSearchIndex = async (message: IndexMessage) => {
  try {
    console.log('>>>> publishToSearchIndex invoked with message: ', message);
    const queueUrl = await getSsmParameter(PENDING_INDEX_QUEUE_SSM_PATH);

    return await sendSqsMessage({
      queueUrl,
      message: JSON.stringify(message),
    });
  } catch (err) {
    console.error(
      `Error trying to send message to SQS queue ${PENDING_INDEX_QUEUE_SSM_PATH}`,
      err,
    );
  }
};

export const publishContactToSearchIndex = async ({
  accountSid,
  contact,
  operation,
}: {
  accountSid: AccountSID;
  contact: Contact;
  operation: IndexMessage['operation'];
}) => publishToSearchIndex({ accountSid, type: 'contact', contact, operation });

export const publishCaseToSearchIndex = async ({
  accountSid,
  case: caseObj,
  operation,
}: {
  accountSid: AccountSID;
  case: CaseService;
  operation: IndexMessage['operation'];
}) => publishToSearchIndex({ accountSid, type: 'case', case: caseObj, operation });

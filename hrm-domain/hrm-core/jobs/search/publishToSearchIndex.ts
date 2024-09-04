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
import { AccountSID, HrmAccountId } from '@tech-matters/types';

const PENDING_INDEX_QUEUE_SSM_PATH = `/${process.env.NODE_ENV}/${
  process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION
}/sqs/jobs/hrm-search-index/queue-url-consumer`;

const publishToSearchIndex = async ({
  message,
  messageGroupId,
}: {
  message: IndexMessage;
  messageGroupId: string;
}) => {
  try {
    console.log(
      '>>>> publishToSearchIndex invoked with message: ',
      JSON.stringify(message),
    );
    const queueUrl = await getSsmParameter(PENDING_INDEX_QUEUE_SSM_PATH);
    console.log('>>>> publishToSearchIndex sending to queue: ', queueUrl);
    return await sendSqsMessage({
      queueUrl,
      message: JSON.stringify(message),
      messageGroupId,
    });
  } catch (err) {
    console.error(
      `Error trying to send message to SQS queue store in SSM parameter ${PENDING_INDEX_QUEUE_SSM_PATH}`,
      err,
    );
  }
};

export const publishContactToSearchIndex = async ({
  accountSid,
  contact,
  operation,
}: {
  accountSid: HrmAccountId;
  contact: Contact;
  operation: IndexMessage['operation'];
}) => {
  console.info(
    `[generalised-search-contacts]: Indexing Started. Account SID: ${accountSid}, Contact ID: ${
      contact.id
    }, Updated / Created At: ${
      contact.updatedAt ?? contact.createdAt
    }. Operation: ${operation}. (key: ${accountSid}/${contact.id}/${
      contact.updatedAt ?? contact.createdAt
    }/${operation})`,
  );
  return publishToSearchIndex({
    message: { accountSid, type: 'contact', contact, operation },
    messageGroupId: `${accountSid}-contact-${contact.id}`,
  });
};

export const publishCaseToSearchIndex = async ({
  accountSid,
  case: caseObj,
  operation,
}: {
  accountSid: AccountSID;
  case: CaseService;
  operation: IndexMessage['operation'];
}) => {
  console.info(
    `[generalised-search-cases]: Indexing Request Started. Account SID: ${accountSid}, Case ID: ${
      caseObj.id
    }, Updated / Created At: ${
      caseObj.updatedAt ?? caseObj.createdAt
    }. Operation: ${operation}. (key: ${accountSid}/${caseObj.id}/${
      caseObj.updatedAt ?? caseObj.createdAt
    }/${operation})`,
  );
  return publishToSearchIndex({
    message: { accountSid, type: 'case', case: caseObj, operation },
    messageGroupId: `${accountSid}-case-${caseObj.id}`,
  });
};

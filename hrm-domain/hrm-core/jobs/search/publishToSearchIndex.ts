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
import { publishSns } from '@tech-matters/sns-client';
import { SsmParameterNotFound } from '@tech-matters/ssm-cache';

type DeleteNotificationPayload = {
  accountSid: HrmAccountId;
  operation: 'delete';
  id: string;
};

type UpsertCaseNotificationPayload = {
  accountSid: HrmAccountId;
  operation: 'update' | 'create';
  case: CaseService;
};

type UpsertContactNotificationPayload = {
  accountSid: HrmAccountId;
  operation: 'update' | 'create';
  contact: Contact;
};

type NotificationPayload =
  | DeleteNotificationPayload
  | UpsertCaseNotificationPayload
  | UpsertContactNotificationPayload;

const PENDING_INDEX_QUEUE_SSM_PATH = `/${process.env.NODE_ENV}/${
  process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION
}/sqs/jobs/hrm-search-index/queue-url-consumer`;

const getSnsSsmPath = dataType =>
  `/${process.env.NODE_ENV}/${
    process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION
  }/sns/hrm/${dataType}/update-notifications-sns-topic`;

const publishToSearchIndex = async ({
  message,
  messageGroupId,
}: {
  message: IndexMessage;
  messageGroupId: string;
}) => {
  try {
    const queueUrl = await getSsmParameter(PENDING_INDEX_QUEUE_SSM_PATH);
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

const publishToSns = async ({
  entityType,
  payload,
  messageGroupId,
}: {
  entityType: 'contact' | 'case';
  payload: NotificationPayload;
  messageGroupId: string;
}) => {
  try {
    const topicArn = await getSsmParameter(getSnsSsmPath(entityType));
    return await publishSns({
      topicArn,
      message: JSON.stringify({ ...payload, entityType }),
      messageGroupId,
    });
  } catch (err) {
    if (err instanceof SsmParameterNotFound) {
      console.debug(
        `No SNS topic stored in SSM parameter ${getSnsSsmPath(
          entityType,
        )}. Skipping publish.`,
      );
      return;
    }
    console.error(
      `Error trying to publish message to SNS topic stored in SSM parameter ${getSnsSsmPath(
        entityType,
      )}`,
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
  const messageGroupId = `${accountSid}-contact-${contact.id}`;
  if (operation === 'remove') {
    await publishToSns({
      entityType: 'contact',
      payload: { accountSid, id: contact.id.toString(), operation: 'delete' },
      messageGroupId,
    });
  } else {
    await publishToSns({
      entityType: 'contact',
      // Update / create are identical for now, will differentiate between the 2 ops in a follow pu refactor PR
      payload: { accountSid, contact, operation: 'update' },
      messageGroupId,
    });
  }
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
  const messageGroupId = `${accountSid}-case-${caseObj.id}`;
  console.info(
    `[generalised-search-cases]: Indexing Request Started. Account SID: ${accountSid}, Case ID: ${
      caseObj.id
    }, Updated / Created At: ${
      caseObj.updatedAt ?? caseObj.createdAt
    }. Operation: ${operation}. (key: ${accountSid}/${caseObj.id}/${
      caseObj.updatedAt ?? caseObj.createdAt
    }/${operation})`,
  );
  if (operation === 'remove') {
    await publishToSns({
      entityType: 'case',
      payload: { accountSid, id: caseObj.id.toString(), operation: 'delete' },
      messageGroupId,
    });
  } else {
    await publishToSns({
      entityType: 'case',
      payload: { accountSid, case: caseObj, operation: 'update' },
      messageGroupId,
    });
  }

  return publishToSearchIndex({
    message: { accountSid, type: 'case', case: caseObj, operation },
    messageGroupId,
  });
};

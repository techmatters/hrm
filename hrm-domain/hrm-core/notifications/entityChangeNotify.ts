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
import { getSsmParameter } from '../config/ssmCache';
import { IndexMessage } from '@tech-matters/hrm-search-config';
import { CaseService, Contact } from '@tech-matters/hrm-types';
import { AccountSID, HrmAccountId } from '@tech-matters/types';
import { publishSns, PublishSnsParams } from '@tech-matters/sns-client';
import { SsmParameterNotFound } from '@tech-matters/ssm-cache';
import { NotificationOperation } from '@tech-matters/hrm-types';

type DeleteNotificationPayload = {
  accountSid: HrmAccountId;
  operation: NotificationOperation & 'delete';
  id: string;
};

type UpsertCaseNotificationPayload = {
  accountSid: HrmAccountId;
  operation: NotificationOperation & ('update' | 'create' | 'reindex' | 'republish');
  case: CaseService;
};

type UpsertContactNotificationPayload = {
  accountSid: HrmAccountId;
  operation: NotificationOperation & ('update' | 'create' | 'reindex' | 'republish');
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
    const publishParameters: PublishSnsParams = {
      topicArn,
      message: JSON.stringify({ ...payload, entityType }),
      messageGroupId,
      messageAttributes: { operation: payload.operation },
    };
    console.debug('Publishing HRM entity update:', publishParameters);
    return await publishSns(publishParameters);
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

const publishEntityToSearchIndex = async (
  accountSid: HrmAccountId,
  entityType: 'contact' | 'case',
  entity: Contact | CaseService,
  operation: NotificationOperation,
) => {
  const messageGroupId = `${accountSid}-${entityType}-${entity.id}`;
  if (operation === 'delete') {
    await publishToSns({
      entityType,
      payload: { accountSid, id: entity.id.toString(), operation },
      messageGroupId,
    });
  } else if (operation === 'republish') {
    await publishToSns({
      entityType,
      payload: {
        accountSid,
        contact: entity as Contact,
        operation: 'republish',
      } as NotificationPayload,
      messageGroupId,
    });
  } else {
    await publishToSns({
      entityType,
      // Update / create are identical for now, will differentiate between the 2 ops in a follow pu refactor PR
      payload: {
        accountSid,
        [entityType]: entity,
        operation,
      } as NotificationPayload,
      messageGroupId,
    });
  }
  const indexOperation: IndexMessage['operation'] =
    operation === 'delete' ? 'index' : 'remove';
  return publishToSearchIndex({
    message: {
      accountSid,
      type: entityType,
      [entityType]: entity,
      operation: indexOperation,
    } as IndexMessage,
    messageGroupId: `${accountSid}-${entityType}-${entity.id}`,
  });
};

export const publishContactChangeNotification = async ({
  accountSid,
  contact,
  operation,
}: {
  accountSid: HrmAccountId;
  contact: Contact;
  operation: NotificationOperation;
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
  return publishEntityToSearchIndex(accountSid, 'contact', contact, operation);
};

export const publishCaseChangeNotification = async ({
  accountSid,
  case: caseObj,
  operation,
}: {
  accountSid: AccountSID;
  case: CaseService;
  operation: NotificationOperation;
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
  return publishEntityToSearchIndex(accountSid, 'case', caseObj, operation);
};

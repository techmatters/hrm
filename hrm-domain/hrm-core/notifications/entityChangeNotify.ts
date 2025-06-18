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
import { ProfileWithRelationships } from '@tech-matters/hrm-types';
import { SsmParameterNotFound, getSsmParameter } from '@tech-matters/ssm-cache';
import {
  CaseSection,
  CaseService,
  Contact,
  TimelineActivity,
} from '@tech-matters/hrm-types';
import { AccountSID, HrmAccountId } from '@tech-matters/types';
import { publishSns, PublishSnsParams } from '@tech-matters/sns-client';
import { NotificationOperation } from '@tech-matters/hrm-types';
import {
  timelineToLegacySections,
  timelineToLegacyConnectedContacts,
} from '../case/caseSection/timelineToLegacyCaseProperties';

type DeleteNotificationPayload = {
  accountSid: HrmAccountId;
  operation: Extract<NotificationOperation, 'delete'>;
  id: string;
};

type UpsertCaseNotificationPayload = {
  accountSid: HrmAccountId;
  operation: Extract<
    NotificationOperation,
    'update' | 'create' | 'reindex' | 'republish'
  >;
  case: CaseService;
};

type UpsertContactNotificationPayload = {
  accountSid: HrmAccountId;
  operation: Extract<
    NotificationOperation,
    'update' | 'create' | 'reindex' | 'republish'
  >;
  contact: Contact;
};

type NotificationPayload =
  | DeleteNotificationPayload
  | UpsertCaseNotificationPayload
  | UpsertContactNotificationPayload;

const getSnsSsmPath = dataType =>
  `/${process.env.NODE_ENV}/${
    process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION
  }/hrm/${dataType}/notifications-sns-topic-arn`;

const publishToSns = async ({
  entityType,
  payload,
  messageGroupId,
}: {
  entityType: 'contact' | 'case' | 'profile';
  payload: NotificationPayload;
  messageGroupId: string;
}) => {
  try {
    const topicArn = await getSsmParameter(getSnsSsmPath(entityType));
    const publishParameters: PublishSnsParams = {
      topicArn,
      message: JSON.stringify({ ...payload, entityType }),
      messageGroupId,
      messageAttributes: { operation: payload.operation, entityType },
    };
    console.debug(
      'Publishing HRM entity update:',
      topicArn,
      entityType,
      payload.operation,
    );
    return await publishSns(publishParameters);
  } catch (err) {
    console.debug('Error trying to publish message to SNS topic', err, payload);
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

type CaseWithLegacySections = CaseService & {
  sections: Record<string, CaseSection[]>;
  connectedContacts: Contact[];
};

export const publishEntityChangeNotification = async (
  accountSid: HrmAccountId,
  entityType: 'contact' | 'case' | 'profile',
  entity: Contact | CaseWithLegacySections | ProfileWithRelationships,
  operation: NotificationOperation,
) => {
  const messageGroupId = `${accountSid}-${entityType}-${entity.id}`;
  let publishResponse: { MessageId?: string };
  if (operation === 'delete') {
    publishResponse = await publishToSns({
      entityType,
      payload: { accountSid, id: entity.id.toString(), operation },
      messageGroupId,
    });
  } else {
    publishResponse = await publishToSns({
      entityType,
      payload: {
        accountSid,
        [entityType]: entity,
        operation,
      } as NotificationPayload,
      messageGroupId,
    });
  }
  return publishResponse;
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
  return publishEntityChangeNotification(accountSid, 'contact', contact, operation);
};

export const publishProfileChangeNotification = async ({
  accountSid,
  case: caseObj,
  operation,
  timeline,
}: {
  accountSid: AccountSID;
  case: CaseService;
  timeline: TimelineActivity<any>[];
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
  return publishEntityChangeNotification(
    accountSid,
    'case',
    {
      ...caseObj,
      sections: timelineToLegacySections(timeline),
      connectedContacts: timelineToLegacyConnectedContacts(timeline),
    },
    operation,
  );
};

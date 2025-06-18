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
import { SsmParameterNotFound, getSsmParameter } from '@tech-matters/ssm-cache';
import {
  CaseService,
  Contact,
  TimelineActivity,
  ProfileWithRelationships,
  NotificationOperation,
  EntityNotificationPayload,
  EntityType,
  EntityByEntityType,
} from '@tech-matters/hrm-types';
import { AccountSID, assertExhaustive, HrmAccountId } from '@tech-matters/types';
import { publishSns, PublishSnsParams } from '@tech-matters/sns-client';
import {
  timelineToLegacySections,
  timelineToLegacyConnectedContacts,
} from '../case/caseSection/timelineToLegacyCaseProperties';

const getSnsSsmPath = (entityType: EntityType) =>
  `/${process.env.NODE_ENV}/${
    process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION
  }/hrm/${entityType}/notifications-sns-topic-arn`;

const publishToSns = async <ET extends EntityType>({
  payload,
  messageGroupId,
}: {
  payload: EntityNotificationPayload[ET];
  messageGroupId: string;
}) => {
  try {
    const topicArn = await getSsmParameter(getSnsSsmPath(payload.entityType));
    const publishParameters: PublishSnsParams = {
      topicArn,
      message: JSON.stringify(payload),
      messageGroupId,
      messageAttributes: { operation: payload.operation },
    };
    console.debug(
      'Publishing HRM entity update:',
      topicArn,
      payload.entityType,
      payload.operation,
    );
    return await publishSns(publishParameters);
  } catch (err) {
    console.debug('Error trying to publish message to SNS topic', err, payload);
    if (err instanceof SsmParameterNotFound) {
      console.debug(
        `No SNS topic stored in SSM parameter ${getSnsSsmPath(
          payload.entityType,
        )}. Skipping publish.`,
      );
      return;
    }
    console.error(
      `Error trying to publish message to SNS topic stored in SSM parameter ${getSnsSsmPath(
        payload.entityType,
      )}`,
      err,
    );
  }
};

const getPayload = <ET extends EntityType>({
  accountSid,
  entity,
  entityType,
  operation,
}: {
  accountSid: HrmAccountId;
  entityType: ET;
  entity: EntityByEntityType[ET];
  operation: Exclude<NotificationOperation, 'delete'>;
}) => {
  switch (entityType) {
    case EntityType.Contact: {
      return {
        accountSid,
        entityType,
        operation,
        contact: entity,
      } as EntityNotificationPayload[EntityType.Contact]; // typecast to conform TS, only valid parameters are accepted anyways
    }
    case EntityType.Case: {
      return {
        accountSid,
        entityType,
        operation,
        case: entity,
      } as EntityNotificationPayload[EntityType.Case]; // typecast to conform TS, only valid parameters are accepted anyways
    }
    case EntityType.Profile: {
      return {
        accountSid,
        entityType,
        operation,
        profile: entity,
      } as EntityNotificationPayload[EntityType.Profile]; // typecast to conform TS, only valid parameters are accepted anyways
    }
    default: {
      return assertExhaustive(entityType);
    }
  }
};

const publishEntityChangeNotification = async <ET extends EntityType>({
  accountSid,
  entity,
  entityType,
  operation,
}: {
  accountSid: HrmAccountId;
  entityType: ET;
  entity: EntityByEntityType[ET];
  operation: NotificationOperation;
}) => {
  const messageGroupId = `${accountSid}-${entityType}-${entity.id.toString()}`;
  let publishResponse: { MessageId?: string };
  if (operation === 'delete') {
    publishResponse = await publishToSns({
      payload: { accountSid, entityType, id: entity.id.toString(), operation },
      messageGroupId,
    });
  } else {
    publishResponse = await publishToSns({
      payload: getPayload({
        accountSid,
        entity,
        entityType,
        operation,
      }),
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
    `[publish-contact-change-notification]: Publish Started. Account SID: ${accountSid}, Contact ID: ${
      contact.id
    }, Updated / Created At: ${
      contact.updatedAt ?? contact.createdAt
    }. Operation: ${operation}. (key: ${accountSid}/${contact.id}/${
      contact.updatedAt ?? contact.createdAt
    }/${operation})`,
  );
  return publishEntityChangeNotification({
    entityType: EntityType.Contact,
    accountSid,
    entity: contact,
    operation,
  });
};

export const publishCaseChangeNotification = async ({
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
    `[publish-case-change-notification]: Publish Request Started. Account SID: ${accountSid}, Case ID: ${
      caseObj.id
    }, Updated / Created At: ${
      caseObj.updatedAt ?? caseObj.createdAt
    }. Operation: ${operation}. (key: ${accountSid}/${caseObj.id}/${
      caseObj.updatedAt ?? caseObj.createdAt
    }/${operation})`,
  );
  return publishEntityChangeNotification({
    accountSid,
    entityType: EntityType.Case,
    entity: {
      ...caseObj,
      sections: timelineToLegacySections(timeline),
      connectedContacts: timelineToLegacyConnectedContacts(timeline),
    },
    operation,
  });
};

export const publishProfileChangeNotification = async ({
  accountSid,
  profile,
  operation,
}: {
  accountSid: HrmAccountId;
  profile: ProfileWithRelationships;
  operation: NotificationOperation;
}) => {
  console.info(
    `[publish-profile-change-notification]: Publish Started. Account SID: ${accountSid}, Contact ID: ${
      profile.id
    }, Updated / Created At: ${
      profile.updatedAt ?? profile.createdAt
    }. Operation: ${operation}. (key: ${accountSid}/${profile.id}/${
      profile.updatedAt ?? profile.createdAt
    }/${operation})`,
  );
  return publishEntityChangeNotification({
    accountSid,
    entityType: EntityType.Profile,
    entity: profile,
    operation,
  });
};

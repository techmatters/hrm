"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publishProfileChangeNotification = exports.publishCaseChangeNotification = exports.publishContactChangeNotification = exports.publishEntityChangeNotification = void 0;
const ssm_cache_1 = require("@tech-matters/ssm-cache");
const sns_client_1 = require("@tech-matters/sns-client");
const timelineToLegacyCaseProperties_1 = require("../case/caseSection/timelineToLegacyCaseProperties");
const getSnsSsmPath = dataType => `/${process.env.NODE_ENV}/${process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION}/hrm/${dataType}/notifications-sns-topic-arn`;
const publishToSns = async ({ entityType, payload, messageGroupId, }) => {
    try {
        const topicArn = await (0, ssm_cache_1.getSsmParameter)(getSnsSsmPath(entityType));
        const publishParameters = {
            topicArn,
            message: JSON.stringify({ ...payload, entityType }),
            messageGroupId,
            messageAttributes: { operation: payload.operation, entityType },
        };
        console.debug('Publishing HRM entity update:', topicArn, entityType, payload.operation);
        return await (0, sns_client_1.publishSns)(publishParameters);
    }
    catch (err) {
        console.debug('Error trying to publish message to SNS topic', err, payload);
        if (err instanceof ssm_cache_1.SsmParameterNotFound) {
            console.debug(`No SNS topic stored in SSM parameter ${getSnsSsmPath(entityType)}. Skipping publish.`);
            return;
        }
        console.error(`Error trying to publish message to SNS topic stored in SSM parameter ${getSnsSsmPath(entityType)}`, err);
    }
};
const publishEntityChangeNotification = async (accountSid, entityType, entity, operation) => {
    // eslint-disable-next-line @typescript-eslint/dot-notation
    delete entity['totalCount'];
    const messageGroupId = `${accountSid}-${entityType}-${entity.id}`;
    let publishResponse;
    if (operation === 'delete') {
        publishResponse = await publishToSns({
            entityType,
            payload: { accountSid, id: entity.id.toString(), operation },
            messageGroupId,
        });
    }
    else {
        publishResponse = await publishToSns({
            entityType,
            payload: {
                accountSid,
                [entityType]: entity,
                operation,
            },
            messageGroupId,
        });
    }
    return publishResponse;
};
exports.publishEntityChangeNotification = publishEntityChangeNotification;
const publishContactChangeNotification = async ({ accountSid, contact, operation, }) => {
    console.info(`[generalised-search-contacts]: Indexing Started. Account SID: ${accountSid}, Contact ID: ${contact.id}, Updated / Created At: ${contact.updatedAt ?? contact.createdAt}. Operation: ${operation}. (key: ${accountSid}/${contact.id}/${contact.updatedAt ?? contact.createdAt}/${operation})`);
    return (0, exports.publishEntityChangeNotification)(accountSid, 'contact', contact, operation);
};
exports.publishContactChangeNotification = publishContactChangeNotification;
const publishCaseChangeNotification = async ({ accountSid, caseObj, operation, timeline, }) => {
    console.info(`[generalised-search-cases]: Indexing Request Started. Account SID: ${accountSid}, Case ID: ${caseObj.id}, Updated / Created At: ${caseObj.updatedAt ?? caseObj.createdAt}. Operation: ${operation}. (key: ${accountSid}/${caseObj.id}/${caseObj.updatedAt ?? caseObj.createdAt}/${operation})`);
    return (0, exports.publishEntityChangeNotification)(accountSid, 'case', {
        ...caseObj,
        sections: (0, timelineToLegacyCaseProperties_1.timelineToLegacySections)(timeline),
        connectedContacts: (0, timelineToLegacyCaseProperties_1.timelineToLegacyConnectedContacts)(timeline),
    }, operation);
};
exports.publishCaseChangeNotification = publishCaseChangeNotification;
const publishProfileChangeNotification = async ({ accountSid, profile, operation, }) => {
    console.info(`[entity-notify-profiles]: Indexing Request Started. Account SID: ${accountSid}, Profile ID: ${profile.id}, Updated / Created At: ${profile.updatedAt ?? profile.createdAt}. Operation: ${operation}. (key: ${accountSid}/${profile.id}/${profile.updatedAt ?? profile.createdAt}/${operation})`);
    return (0, exports.publishEntityChangeNotification)(accountSid, 'profile', profile, operation);
};
exports.publishProfileChangeNotification = publishProfileChangeNotification;

"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContactBuilder = void 0;
const defaultContactRecord = {
    id: 0,
    createdAt: new Date(2000, 0, 1).toISOString(),
    accountSid: 'AC-account-sid',
    number: 'Anonymous',
    rawJson: {
        callType: 'Someone calling about a child',
        childInformation: {},
        callerInformation: {},
        caseInformation: {
            callSummary: '',
        },
        categories: {},
    },
    channel: '',
    conversationDuration: undefined,
    csamReports: [],
};
class ContactBuilder {
    id;
    childFirstName;
    childLastName;
    callSummary;
    number;
    callType;
    twilioWorkerId;
    createdBy;
    createdAt;
    finalizedAt;
    timeOfContact;
    channel;
    conversationDuration;
    helpline;
    taskId;
    withId(id) {
        this.id = id;
        return this;
    }
    withHelpline(helpline) {
        this.helpline = helpline;
        return this;
    }
    withTaskId(taskId) {
        this.taskId = taskId;
        return this;
    }
    withChildFirstName(childFirstName) {
        this.childFirstName = childFirstName;
        return this;
    }
    withChildLastName(childLastName) {
        this.childLastName = childLastName;
        return this;
    }
    withCallSummary(callSummary) {
        this.callSummary = callSummary;
        return this;
    }
    withNumber(number) {
        this.number = number;
        return this;
    }
    withCallType(callType) {
        this.callType = callType;
        return this;
    }
    withTwilioWorkerId(twilioWorkerId) {
        this.twilioWorkerId = twilioWorkerId;
        return this;
    }
    withCreatedBy(workerSid) {
        this.createdBy = workerSid;
        return this;
    }
    withFinalizedAt(finalizedAt) {
        this.finalizedAt = finalizedAt.toISOString();
        return this;
    }
    withCreatedAt(createdAt) {
        this.createdAt = createdAt.toISOString();
        return this;
    }
    withTimeOfContact(timeOfContact) {
        this.timeOfContact = timeOfContact.toISOString();
        return this;
    }
    withChannel(channel) {
        this.channel = channel;
        return this;
    }
    withConversationDuration(conversationDuration) {
        this.conversationDuration = conversationDuration;
        return this;
    }
    build() {
        return {
            ...defaultContactRecord,
            ...(this.id && { id: this.id }),
            ...(this.helpline && { helpline: this.helpline }),
            ...(this.taskId && { taskId: this.taskId }),
            ...(this.number && { number: this.number }),
            ...(this.twilioWorkerId && { twilioWorkerId: this.twilioWorkerId }),
            ...(this.createdAt && { createdAt: this.createdAt }),
            ...(this.createdBy && { createdBy: this.createdBy }),
            ...(this.finalizedAt && { finalizedAt: this.finalizedAt }),
            ...(this.timeOfContact && { timeOfContact: this.timeOfContact }),
            rawJson: {
                ...defaultContactRecord.rawJson,
                ...(this.number && { number: this.number }),
                ...(this.callType && { callType: this.callType }),
                childInformation: {
                    ...defaultContactRecord.rawJson.childInformation,
                    ...(this.childFirstName && { firstName: this.childFirstName }),
                    ...(this.childLastName && { lastName: this.childLastName }),
                },
                caseInformation: {
                    ...defaultContactRecord.rawJson.caseInformation,
                    ...(this.callSummary && { callSummary: this.callSummary }),
                },
            },
            ...(this.channel && { channel: this.channel }),
            ...(this.conversationDuration && {
                conversationDuration: this.conversationDuration,
            }),
            csamReports: [],
            referrals: [],
            conversationMedia: [],
        };
    }
    buildContact() {
        const record = this.build();
        return {
            ...record,
            id: record.id.toString(),
            ...(record.caseId ? { caseId: record.caseId.toString() } : {}),
        };
    }
}
exports.ContactBuilder = ContactBuilder;

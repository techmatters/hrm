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

import { Contact, ContactRecord } from '../../contact/contactDataAccess';
import { TwilioUserIdentifier, WorkerSID } from '@tech-matters/types';

const defaultContactRecord: ContactRecord = {
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

export class ContactBuilder {
  private id: number;

  private childFirstName: string;

  private childLastName: string;

  private callSummary: string;

  private number: string;

  private callType: string;

  private twilioWorkerId: WorkerSID;

  private createdBy: TwilioUserIdentifier;

  private createdAt: string;

  private finalizedAt: string;

  private timeOfContact: string;

  private channel: string;

  private conversationDuration: number;

  private helpline: string;

  private taskId: string;

  withId(id: number): ContactBuilder {
    this.id = id;
    return this;
  }

  withHelpline(helpline: string): ContactBuilder {
    this.helpline = helpline;
    return this;
  }

  withTaskId(taskId: string): ContactBuilder {
    this.taskId = taskId;
    return this;
  }

  withChildFirstName(childFirstName: string): ContactBuilder {
    this.childFirstName = childFirstName;
    return this;
  }

  withChildLastName(childLastName: string): ContactBuilder {
    this.childLastName = childLastName;
    return this;
  }

  withCallSummary(callSummary: string): ContactBuilder {
    this.callSummary = callSummary;
    return this;
  }

  withNumber(number: string): ContactBuilder {
    this.number = number;
    return this;
  }

  withCallType(callType: string): ContactBuilder {
    this.callType = callType;
    return this;
  }

  withTwilioWorkerId(twilioWorkerId: WorkerSID): ContactBuilder {
    this.twilioWorkerId = twilioWorkerId;
    return this;
  }

  withCreatedBy(workerSid: TwilioUserIdentifier): ContactBuilder {
    this.createdBy = workerSid;
    return this;
  }

  withFinalizedAt(finalizedAt: Date): ContactBuilder {
    this.finalizedAt = finalizedAt.toISOString();
    return this;
  }

  withCreatedAt(createdAt: Date): ContactBuilder {
    this.createdAt = createdAt.toISOString();
    return this;
  }

  withTimeOfContact(timeOfContact: Date): ContactBuilder {
    this.timeOfContact = timeOfContact.toISOString();
    return this;
  }

  withChannel(channel: string): ContactBuilder {
    this.channel = channel;
    return this;
  }

  withConversationDuration(conversationDuration: number): ContactBuilder {
    this.conversationDuration = conversationDuration;
    return this;
  }

  build(): ContactRecord {
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
          ...defaultContactRecord.rawJson!.childInformation,
          ...(this.childFirstName && { firstName: this.childFirstName }),
          ...(this.childLastName && { lastName: this.childLastName }),
        },
        caseInformation: {
          ...defaultContactRecord.rawJson!.caseInformation,
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

  buildContact(): Contact {
    const record = this.build();
    return {
      ...record,
      id: record.id.toString(),
      ...(record.caseId ? { caseId: record.caseId.toString() } : {}),
    } as unknown as Contact;
  }
}

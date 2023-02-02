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

import { Contact } from '../../src/contact/contact-data-access';

const defaultContact: Contact = {
  id: 0,
  accountSid: 'account-sid',
  number: 'Anonymous',
  rawJson: {
    callType: 'Someone calling about a child',
    childInformation: {},
    callerInformation: {},
    caseInformation: {
      callSummary: '',
      categories: {},
    },
  },
  channel: '',
  conversationDuration: null,
  csamReports: [],
};

export class ContactBuilder {
  private id: number;

  private childFirstName: string;

  private childLastName: string;

  private callSummary: string;

  private number: string;

  private callType: string;

  private twilioWorkerId: string;

  private createdBy: string;

  private createdAt: Date;

  private timeOfContact: Date;

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

  withTwilioWorkerId(twilioWorkerId: string): ContactBuilder {
    this.twilioWorkerId = twilioWorkerId;
    return this;
  }

  withCreatedBy(workerSid: string): ContactBuilder {
    this.createdBy = workerSid;
    return this;
  }

  withCreatedAt(createdAt: Date): ContactBuilder {
    this.createdAt = createdAt;
    return this;
  }

  withTimeOfContact(timeOfContact: Date): ContactBuilder {
    this.timeOfContact = timeOfContact;
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

  build(): Contact {
    return {
      ...defaultContact,
      ...(this.id && { id: this.id }),
      ...(this.helpline && { helpline: this.helpline }),
      ...(this.taskId && { taskId: this.taskId }),
      ...(this.number && { number: this.number }),
      ...(this.twilioWorkerId && { twilioWorkerId: this.twilioWorkerId }),
      ...(this.createdAt && { createdAt: this.createdAt }),
      ...(this.createdBy && { createdBy: this.createdBy }),
      ...(this.timeOfContact && { timeOfContact: this.timeOfContact }),
      rawJson: {
        ...defaultContact.rawJson,
        ...(this.number && { number: this.number }),
        ...(this.callType && { callType: this.callType }),
        childInformation: {
          ...defaultContact.rawJson.childInformation,
          ...(this.childFirstName && { firstName: this.childFirstName }),
          ...(this.childLastName && { lastName: this.childLastName }),
        },
        caseInformation: {
          ...defaultContact.rawJson.caseInformation,
          ...(this.callSummary && { callSummary: this.callSummary }),
        },
      },
      ...(this.channel && { channel: this.channel }),
      ...(this.conversationDuration && { conversationDuration: this.conversationDuration }),
      csamReports: [],
    };
  }
}

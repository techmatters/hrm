const parseISO = require('date-fns/parseISO');
const subMinutes = require('date-fns/subMinutes');

const defaultContact = {
  number: 'Anonymous',
  rawJson: {
    callType: 'Someone calling about a child',
    childInformation: {
      name: {
        firstName: '',
        lastName: '',
      },
    },
    callerInformation: {
      name: {
        firstName: '',
        lastName: '',
      },
    },
    caseInformation: {
      callSummary: '',
    },
  },
  channel: '',
  conversationDuration: null,
};

class ContactBuilder {
  withId(id) {
    this.id = id;
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

  withCreatedAt(createdAt) {
    const date = parseISO(createdAt);
    const timezoneOffset = date.getTimezoneOffset();
    this.createdAt = subMinutes(date, timezoneOffset).toISOString();
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
      ...defaultContact,
      ...(this.id && { id: this.id }),
      ...(this.number && { number: this.number }),
      ...(this.twilioWorkerId && { twilioWorkerId: this.twilioWorkerId }),
      ...(this.createdAt && { createdAt: this.createdAt }),
      rawJson: {
        ...defaultContact.rawJson,
        ...(this.number && { number: this.number }),
        ...(this.callType && { callType: this.callType }),
        childInformation: {
          ...defaultContact.rawJson.childInformation,
          name: {
            ...defaultContact.rawJson.childInformation.name,
            ...(this.childFirstName && { firstName: this.childFirstName }),
            ...(this.childLastName && { lastName: this.childLastName }),
          },
        },
        caseInformation: {
          ...defaultContact.rawJson.caseInformation,
          ...(this.callSummary && { callSummary: this.callSummary }),
        },
      },
      ...(this.channel && { channel: this.channel }),
      ...(this.conversationDuration && { conversationDuration: this.conversationDuration }),
    };
  }
}

module.exports = ContactBuilder;

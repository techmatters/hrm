const ActivityTypes = {
  createCase: 'create',
  addNote: 'note',
  connectContact: {
    voice: 'voice',
    whatsapp: 'whatsapp',
    facebook: 'facebook',
    web: 'web',
    sms: 'sms',
    default: 'default',
  },
  unknown: 'unknown',
};

function createAddNoteActivity({ previousValue, newValue, createdAt, twilioWorkerId }) {
  const previousNotes = (previousValue && previousValue.info && previousValue.info.notes) || [];
  const newNotes = (newValue && newValue.info && newValue.info.notes) || [];
  const newNote =
    newNotes.find(note => !previousNotes.includes(note)) || newNotes[newNotes.length - 1];

  return {
    date: createdAt,
    type: ActivityTypes.addNote,
    text: newNote,
    twilioWorkerId,
  };
}

function createConnectContactActivity(
  { previousValue, newValue, createdAt, twilioWorkerId },
  type,
  relatedContacts,
) {
  const previousContacts = (previousValue && previousValue.contacts) || [];
  const newContacts = (newValue && newValue.contacts) || [];
  const newContactId = newContacts.find(contact => !previousContacts.includes(contact));
  const newContact = relatedContacts.find(contact => contact.id === newContactId);

  const icon =
    type === ActivityTypes.connectContact.default
      ? newContact.rawJson.contactlessTask.channel
      : type;

  return {
    date: createdAt,
    type,
    text: newContact.rawJson.caseInformation.callSummary,
    twilioWorkerId,
    icon,
  };
}

function getActivityType({ previousValue, newValue }, relatedContacts) {
  const previousNotesCount =
    (previousValue &&
      previousValue.info &&
      previousValue.info.notes &&
      previousValue.info.notes.length) ||
    0;
  const newNotesCount =
    (newValue && newValue.info && newValue.info.notes && newValue.info.notes.length) || 0;
  const previousContacts = (previousValue && previousValue.contacts) || [];
  const newContacts = (newValue && newValue.contacts) || [];

  let activityType;

  if (!previousValue && newValue) {
    activityType = ActivityTypes.createCase;
  } else if (previousNotesCount < newNotesCount) {
    activityType = ActivityTypes.addNote;
  } else if (previousContacts.length < newContacts.length) {
    const newContactId = newContacts.find(contact => !previousContacts.includes(contact));
    const newContact = relatedContacts.find(contact => contact.id === newContactId);

    activityType = ActivityTypes.connectContact[newContact.channel];
  } else {
    activityType = ActivityTypes.unknown;
  }

  return activityType;
}

function getActivity(caseAudit, relatedContacts) {
  const activityType = getActivityType(caseAudit, relatedContacts);
  const isConnectContactType = type => Object.keys(ActivityTypes.connectContact).includes(type);
  let activity;

  if (activityType === ActivityTypes.addNote) {
    activity = createAddNoteActivity(caseAudit);
  } else if (isConnectContactType(activityType)) {
    activity = createConnectContactActivity(caseAudit, activityType, relatedContacts);
  }

  return activity;
}

module.exports = { getActivity };

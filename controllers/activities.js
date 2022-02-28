const models = require('../models');

const { Contact, Case, CaseAudit, sequelize } = models;
const ContactController = require('../controllers/contact-controller')(Contact);
const CaseController = require('../controllers/case-controller')(Case, sequelize);
const CaseAuditController = require('../controllers/case-audit-controller')(CaseAudit);

const ActivityTypes = {
  createCase: 'create',
  addNote: 'note',
  addReferral: 'referral',
  connectContact: {
    voice: 'voice',
    whatsapp: 'whatsapp',
    facebook: 'facebook',
    web: 'web',
    sms: 'sms',
    twitter: 'twitter',
    default: 'default',
  },
  unknown: 'unknown',
};

const isConnectContactType = type => Object.keys(ActivityTypes.connectContact).includes(type);

function getObjectsFromInfo(caseObj, name) {
  return (caseObj && caseObj.info && caseObj.info[name]) || [];
}

function createAddNoteActivity({ previousValue, newValue, createdAt, twilioWorkerId }) {
  const previousNotes = getObjectsFromInfo(previousValue, 'notes');
  const newNotes = getObjectsFromInfo(newValue, 'notes');
  const newNote =
    newNotes.find(note => !previousNotes.includes(note)) || newNotes[newNotes.length - 1];

  return {
    date: createdAt,
    type: ActivityTypes.addNote,
    text: newNote,
    twilioWorkerId,
  };
}

function createAddReferralActivity({ previousValue, newValue, createdAt, twilioWorkerId }) {
  const previousReferrals = getObjectsFromInfo(previousValue, 'referrals');
  const newReferrals = getObjectsFromInfo(newValue, 'referrals');
  const isEqual = (a, b) =>
    a.date === b.date && a.referredTo === b.referredTo && a.comments === b.comments;
  const newReferral =
    newReferrals.find(referral => !previousReferrals.some(r => isEqual(referral, r))) ||
    newReferrals[newReferrals.length - 1];

  return {
    date: newReferral.date,
    createdAt,
    type: ActivityTypes.addReferral,
    text: newReferral.referredTo,
    referral: newReferral,
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

  const channel =
    type !== ActivityTypes.connectContact.default
      ? type
      : newContact.rawJson.contactlessTask.channel;

  return {
    contactId: newContactId,
    date: newContact.timeOfContact,
    createdAt,
    type,
    text: newContact.rawJson.caseInformation.callSummary,
    twilioWorkerId,
    channel,
  };
}

function getActivityType({ previousValue, newValue }, relatedContacts) {
  const previousNotesCount = getObjectsFromInfo(previousValue, 'notes').length;
  const newNotesCount = getObjectsFromInfo(newValue, 'notes').length;
  const previousReferralsCount = getObjectsFromInfo(previousValue, 'referrals').length;
  const newReferralsCount = getObjectsFromInfo(newValue, 'referrals').length;
  const previousContacts = (previousValue && previousValue.contacts) || [];
  const newContacts = (newValue && newValue.contacts) || [];

  let activityType;

  if (!previousValue && newValue) {
    activityType = ActivityTypes.createCase;
  } else if (previousNotesCount < newNotesCount) {
    activityType = ActivityTypes.addNote;
  } else if (previousReferralsCount < newReferralsCount) {
    activityType = ActivityTypes.addReferral;
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
  let activity;

  if (activityType === ActivityTypes.addNote) {
    activity = createAddNoteActivity(caseAudit);
  } else if (activityType === ActivityTypes.addReferral) {
    activity = createAddReferralActivity(caseAudit);
  } else if (isConnectContactType(activityType)) {
    activity = createConnectContactActivity(caseAudit, activityType, relatedContacts);
  }

  return activity;
}

const convertAuditsAndContactsToActivities = async (caseAudits, relatedContacts) => {
  const activities = [];

  caseAudits.forEach(caseAudit => {
    const activity = getActivity(caseAudit, relatedContacts);
    if (activity) activities.push(activity);
  });

  return activities;
};

const getCaseActivities = async (caseId, accountSid) => {
  await CaseController.getCase(caseId, accountSid);
  const caseAudits = await CaseAuditController.getAuditsForCase(caseId, accountSid);
  const contactIds = [...new Set(caseAudits.flatMap(caseAudit => caseAudit.newValue.contacts))];
  const relatedContacts = await ContactController.getContactsById(contactIds, accountSid);
  return convertAuditsAndContactsToActivities(caseAudits, relatedContacts);
};

module.exports = { getCaseActivities, convertAuditsAndContactsToActivities, getActivity };

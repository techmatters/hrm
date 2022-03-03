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
    instagram: 'instagram',
    default: 'default',
  },
  unknown: 'unknown',
};

const isConnectContactType = type => Object.keys(ActivityTypes.connectContact).includes(type);

function getObjectsFromInfo(caseObj, name) {
  return (caseObj && caseObj.info && caseObj.info[name]) || [];
}

const noteActivities = ({ counsellorNotes }) =>
  (counsellorNotes || [])
    .map(n => {
      try {
        return {
          date: n.createdAt,
          type: ActivityTypes.addNote,
          text: n.note,
          twilioWorkerId: n.twilioWorkerId,
        };
      } catch (err) {
        console.warn(`Error processing referral, excluding from data`, n, err);
        return null;
      }
    })
    .filter(na => na);

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

const referralActivities = ({ referrals }) =>
  (referrals || [])
    .map(r => {
      try {
        return {
          date: r.date,
          createdAt: r.createdAt,
          type: ActivityTypes.addReferral,
          text: r.referredTo,
          twilioWorkerId: r.twilioWorkerId,
          referral: r,
        };
      } catch (err) {
        console.warn(`Error processing referral, excluding from data`, r, err);
        return null;
      }
    })
    .filter(ra => ra);

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
    date: new Date(newContact.timeOfContact),
    createdAt,
    type,
    text: newContact.rawJson.caseInformation.callSummary,
    twilioWorkerId,
    channel,
  };
}

const connectedContactActivities = caseContacts =>
  (caseContacts || [])
    .map(cc => {
      try {
        const type = ActivityTypes.connectContact[cc.channel];
        const channel =
          type !== ActivityTypes.connectContact.default ? type : cc.rawJson.contactlessTask.channel;
        return {
          contactId: cc.id,
          date: cc.timeOfContact,
          createdAt: cc.createdAt,
          type,
          text: cc.rawJson.caseInformation.callSummary,
          twilioWorkerId: cc.twilioWorkerId,
          channel,
        };
      } catch (err) {
        console.warn(`Error processing connected contact, excluding from data`, cc, err);
        return null;
      }
    })
    .filter(cca => cca);

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
  const dbCase = await CaseController.getCase(caseId, accountSid);
  return [
    ...noteActivities(dbCase.info),
    ...referralActivities(dbCase.info),
    ...connectedContactActivities(dbCase.connectedContacts),
  ].sort((activity1, activity2) => {
    try {
      return new Date(activity2.date) - new Date(activity1.date);
    } catch (err) {
      console.warn(
        'Failed to create data objects from data properties for sorting, falling back to simple text comparison',
        activity1.date,
        activity2.date,
        err,
      );
      return (activity2.date || '').toString().localeCompare((activity1.date || '').toString());
    }
  });
};

module.exports = { getCaseActivities };

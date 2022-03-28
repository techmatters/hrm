const models = require('../models');

const { Case, sequelize } = models;
const CaseController = require('./case-controller')(Case, sequelize);

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

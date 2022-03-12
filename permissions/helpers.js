const isSupervisor = user => user.roles.includes('supervisor');

const isCounselorWhoCreated = (user, caseObj) =>
  user.workerSid === caseObj.dataValues.twilioWorkerId;

const isCaseOpen = caseObj => caseObj.dataValues.status !== 'closed';

module.exports = { isSupervisor, isCounselorWhoCreated, isCaseOpen };

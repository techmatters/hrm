const isSupervisor = user => user.roles.includes('supervisor');

const isCounselorWhoCreated = (user, caseObj) =>
  user.workerSid === caseObj.dataValues.twilioWorkerId;

module.exports = { isSupervisor, isCounselorWhoCreated };

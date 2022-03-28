const Sequelize = require('sequelize');

const { Op } = Sequelize;

const PostSurveyController = PostSurvey => {
  /**
   * @param {string} contactTaskId
   * @param {string} accountSid
   */
  const getPostSurveysByContactTaskId = async (contactTaskId, accountSid) => {
    const queryObject = {
      where: {
        [Op.and]: [accountSid && { accountSid }, contactTaskId && { contactTaskId }],
      },
    };

    return PostSurvey.findAll(queryObject);
  };

  /**
   * @param {{ taskId: string; contactTaskId: string; data: {} }} body
   * @param {string} accountSid
   */
  const createPostSurvey = async (body, accountSid) => {
    const record = {
      accountSid: accountSid || '',
      taskId: body.taskId || '',
      contactTaskId: body.contactTaskId || '',
      data: body.data,
    };

    const postSurvey = await PostSurvey.create(record);
    return postSurvey;
  };

  return {
    getPostSurveysByContactTaskId,
    createPostSurvey,
  };
};

module.exports = PostSurveyController;

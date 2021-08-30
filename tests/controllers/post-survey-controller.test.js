const Sequelize = require('sequelize');
const SequelizeMock = require('sequelize-mock');
const createPostSurveyController = require('../../controllers/post-survey-controller');

const DBConnectionMock = new SequelizeMock();
const MockPostSurvey = DBConnectionMock.define('PostSurveys');

const PostSurveyController = createPostSurveyController(MockPostSurvey);

const { Op } = Sequelize;

const accountSid = 'account-sid';

test('create post survey', async () => {
  const createSpy = jest.spyOn(MockPostSurvey, 'create');

  const postSurveyToBeCreated = {
    helpline: 'helpline',
    contactTaskId: 'WTxxxxxxxxxx',
    taskId: 'WTyyyyyyyyyy',
    data: { question: 'Some Answer' },
    accountSid,
  };

  await PostSurveyController.createPostSurvey(postSurveyToBeCreated, accountSid);

  expect(createSpy).toHaveBeenCalledWith(postSurveyToBeCreated);
});

test('get all post surveys', async () => {
  const options = {
    limit: 10,
    where: { [Op.and]: [{ accountSid }] },
  };

  const findAllSpy = jest.spyOn(MockPostSurvey, 'findAll');

  await PostSurveyController.getPostSurveys({}, accountSid);

  expect(findAllSpy).toHaveBeenCalledWith(options);
});

test('get all post surveys by contact id', async () => {
  const contactTaskId = 'WTxxxxxxxxxx';

  const options = {
    where: { [Op.and]: [{ accountSid }, { contactTaskId }] },
  };

  const findAllSpy = jest.spyOn(MockPostSurvey, 'findAll');

  await PostSurveyController.getPostSurveysByContactTaskId(contactTaskId, accountSid);

  expect(findAllSpy).toHaveBeenCalledWith(options);
});

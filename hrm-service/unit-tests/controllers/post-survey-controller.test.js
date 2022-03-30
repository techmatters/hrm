const Sequelize = require('sequelize');
const SequelizeMock = require('sequelize-mock');
const createPostSurveyController = require('../../src/controllers/post-survey-controller');

const DBConnectionMock = new SequelizeMock();
const MockPostSurvey = DBConnectionMock.define('PostSurveys');

const PostSurveyController = createPostSurveyController(MockPostSurvey);

const { Op } = Sequelize;

const accountSid = 'account-sid';

test('create post survey', async () => {
  const createSpy = jest.spyOn(MockPostSurvey, 'create');

  const postSurveyToBeCreated = {
    contactTaskId: 'WTxxxxxxxxxx',
    taskId: 'WTyyyyyyyyyy',
    data: { question: 'Some Answer' },
    accountSid,
  };

  await PostSurveyController.createPostSurvey(postSurveyToBeCreated, accountSid);

  expect(createSpy).toHaveBeenCalledWith(postSurveyToBeCreated);
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

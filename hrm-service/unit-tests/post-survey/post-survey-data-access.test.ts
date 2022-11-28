import { mockConnection, mockTask } from '../mock-pgpromise';
import * as pgPromise from 'pg-promise';
import { subDays } from 'date-fns';
import {
  PostSurvey,
  filterByContactTaskId,
  NewPostSurvey,
  create,
} from '../../src/post-survey/post-survey-data-access';
let conn: pgPromise.ITask<unknown>;
const accountSid = 'account-sid';

beforeEach(() => {
  conn = mockConnection();
});

const baselineDate = new Date(2010, 6, 1);

test('filterByContactTaskId runs query using account and contact task ids, and returns all matching post surveys.', async () => {
  const contactTaskId = 'CONTACT TASK ID';
  mockTask(conn);
  const postSurveysFromDB: PostSurvey[] = [
    {
      id: '1',
      contactTaskId,
      taskId: 'TASK 1',
      data: {
        some: 'stuff',
      },
      createdAt: subDays(baselineDate, 1),
      updatedAt: subDays(baselineDate, 1),
    },
    {
      id: '2',
      contactTaskId,
      taskId: 'TASK 2',
      data: {
        more: 'crap',
        something: 'else',
      },
      createdAt: subDays(baselineDate, 2),
      updatedAt: subDays(baselineDate, 2),
    },
  ];
  const manyOrNoneSpy = jest.spyOn(conn, 'manyOrNone').mockResolvedValue(postSurveysFromDB);

  const result = await filterByContactTaskId(accountSid, contactTaskId);

  expect(manyOrNoneSpy).toHaveBeenCalledWith(
    expect.stringContaining('PostSurveys'),
    expect.objectContaining({ accountSid, contactTaskId }),
  );
  expect(result).toStrictEqual(postSurveysFromDB);
});

test('create runs query using account and provided post survey object, and returns created post survey.', async () => {
  const contactTaskId = 'INSERT CONTACT TASK ID';
  mockTask(conn);
  const newPostSurvey: NewPostSurvey = {
    contactTaskId,
    taskId: 'TASK 1',
    data: {
      some: 'stuff',
    },
  };
  const postSurveyFromDB: PostSurvey = {
    ...newPostSurvey,
    id: '100',
    createdAt: baselineDate,
    updatedAt: baselineDate,
  };
  const oneSpy = jest.spyOn(conn, 'one').mockResolvedValue(postSurveyFromDB);

  const result = await create(accountSid, newPostSurvey);

  expect(oneSpy).toHaveBeenCalledWith(
    expect.stringContaining(accountSid), // Not a great assertion but jest assertions are crappy. TODO: write a custom assertion
  );
  expect(result).toStrictEqual(postSurveyFromDB);
});

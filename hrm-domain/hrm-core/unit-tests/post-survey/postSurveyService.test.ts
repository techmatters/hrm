/**
 * Copyright (C) 2021-2023 Technology Matters
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see https://www.gnu.org/licenses/.
 */

import * as entityChangeNotify from '../../notifications/entityChangeNotify';
import * as contactDataAccess from '../../contact/contactDataAccess';
import * as postSurveyDataAccess from '../../post-survey/postSurveyDataAccess';
import { createPostSurvey } from '../../post-survey/postSurveyService';
import { NewPostSurvey, PostSurvey } from '../../post-survey/postSurveyDataAccess';

jest.mock('../../contact/contactDataAccess');
jest.mock('../../post-survey/postSurveyDataAccess');

const accountSid = 'AC-account-sid';
const newPostSurvey: NewPostSurvey = {
  contactTaskId: 'WT-contact-task',
  taskId: 'WT-survey-task',
  data: { comments: 'Some answer' },
};
const createdPostSurvey: PostSurvey = {
  ...newPostSurvey,
  id: '1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const publishContactChangeNotificationSpy = jest
  .spyOn(entityChangeNotify, 'publishContactChangeNotification')
  .mockResolvedValue({ MessageId: 'message-id' } as any);
const getByTaskSidMock = contactDataAccess.getByTaskSid as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  (postSurveyDataAccess.create as jest.Mock).mockResolvedValue(createdPostSurvey);
});

describe('createPostSurvey', () => {
  test('publishes an update for the contact the survey belongs to', async () => {
    getByTaskSidMock.mockResolvedValue({
      id: 123,
      accountSid,
      taskId: newPostSurvey.contactTaskId,
      postSurveys: [createdPostSurvey],
    } as any);

    const result = await createPostSurvey(accountSid, newPostSurvey);

    expect(result).toStrictEqual(createdPostSurvey);
    expect(getByTaskSidMock).toHaveBeenCalledWith(
      accountSid,
      newPostSurvey.contactTaskId,
    );
    expect(publishContactChangeNotificationSpy).toHaveBeenCalledWith({
      accountSid,
      operation: 'update',
      contact: expect.objectContaining({
        id: '123',
        postSurveys: [createdPostSurvey],
      }),
    });
  });

  test("doesn't publish anything if the contact doesn't exist yet", async () => {
    getByTaskSidMock.mockResolvedValue(null);

    const result = await createPostSurvey(accountSid, newPostSurvey);

    expect(result).toStrictEqual(createdPostSurvey);
    expect(publishContactChangeNotificationSpy).not.toHaveBeenCalled();
  });

  test('still returns the created survey if publishing fails', async () => {
    getByTaskSidMock.mockRejectedValue(new Error('boom'));

    const result = await createPostSurvey(accountSid, newPostSurvey);

    expect(result).toStrictEqual(createdPostSurvey);
    expect(publishContactChangeNotificationSpy).not.toHaveBeenCalled();
  });
});

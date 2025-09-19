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

import type { Request, Response } from 'express';
import {
  SafeRouter,
  publicEndpoint,
  actionsMaps,
  RequestWithPermissions,
} from '../permissions';
import { NewPostSurvey, PostSurvey } from './postSurveyDataAccess';
import { createPostSurvey, getPostSurveysByContactTaskId } from './postSurveyService';

const newPostSurveyRouter = (isPublic: boolean) => {
  const postSurveysRouter = SafeRouter();

  // Public only endpoints
  if (isPublic) {
    const canViewPostSurvey = (req: RequestWithPermissions, res, next) => {
      if (!req.isPermitted()) {
        const { user, can } = req;

        // Nothing from the target param is being used for postSurvey target kind, we can pass null for now
        if (can(user, actionsMaps.postSurvey.VIEW_POST_SURVEY, null)) {
          console.debug(
            `[Permission - PERMITTED] User ${user.workerSid} is permitted to perform ${actionsMaps.postSurvey.VIEW_POST_SURVEY} on account ${req.hrmAccountId}`,
          );
          req.permit();
        } else {
          console.debug(
            `[Permission - BLOCKED] User ${user.workerSid} is not permitted to perform ${actionsMaps.postSurvey.VIEW_POST_SURVEY} on account ${req.hrmAccountId}`,
          );
          req.block();
        }
      }

      next();
    };

    postSurveysRouter.get(
      '/contactTaskId/:id',
      canViewPostSurvey,
      async (req: Request, res: Response) => {
        const { hrmAccountId } = req;
        const { id } = req.params;

        const postSurveys = await getPostSurveysByContactTaskId(hrmAccountId, id);
        res.json(postSurveys);
      },
    );
  }

  postSurveysRouter.post(
    '/',
    publicEndpoint,
    async (req: Request<NewPostSurvey>, res: Response<PostSurvey>) => {
      const { hrmAccountId } = req;

      const createdPostSurvey = await createPostSurvey(hrmAccountId, req.body);
      res.json(createdPostSurvey);
    },
  );

  return postSurveysRouter.expressRouter;
};

export default newPostSurveyRouter;

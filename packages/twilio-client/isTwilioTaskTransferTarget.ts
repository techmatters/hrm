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

import { Twilio } from 'twilio';
import { TaskInstance } from 'twilio/lib/rest/taskrouter/v1/workspace/task';

const isTwilioTaskTransferTarget = async (
  twilioClient: Twilio,
  taskSid: string,
  originalTaskSid: string,
  workerSid: string,
) => {
  // Search each workspace for the task - we could pass the workspace into HRM, but twilio sids are globally unique anyway
  const workspaces = await twilioClient.taskrouter.workspaces.list();
  let task: TaskInstance | undefined = undefined;
  for (const workspace of workspaces) {
    task = await workspace.tasks().get(taskSid).fetch();
    if (task) {
      break;
    }
  }
  if (!task) {
    console.warn(`Task ${taskSid} not found in any workspace`);
    return false;
  }

  // Check that the task ID currently in the DB matches the original task ID
  const taskAttributes = JSON.parse(task.attributes ?? '{}');
  if (taskAttributes.transferMeta?.originalTask !== originalTaskSid) {
    return false;
  }

  // Check that the worker attempting the edit is currently reserved on the task
  const reservations = await task.reservations().list();
  return Boolean(reservations.find(r => r.workerSid === workerSid));
};

export default isTwilioTaskTransferTarget;

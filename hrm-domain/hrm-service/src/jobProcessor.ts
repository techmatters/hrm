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

import { handleSignals } from './handleSignals';
import { processContactJobs } from '@tech-matters/hrm-core/contact-job/contact-job-processor';

const processorIntervalId = processContactJobs();

const gracefulExit = async () => {
  //TODO: this should probably handle closing any running processes and open db connections
  clearInterval(processorIntervalId);
};

handleSignals(gracefulExit);

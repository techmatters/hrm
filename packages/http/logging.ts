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

import morgan from 'morgan';

/**
 * Basic HTTP Logger that shows information about each request.
 * Example: 200 - GET /contacts HTTP/1.1 - time: 10 ms length: 95 - Agent: curl/7.58.0
 */
const httpLogger = morgan(
  ':status - :method :url HTTP/:http-version - time: :response-time ms - length: :res[content-length] - Agent: :user-agent',
);

export default httpLogger;

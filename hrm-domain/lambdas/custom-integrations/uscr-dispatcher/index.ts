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

// eslint-disable-next-line prettier/prettier
import type { ALBEvent, ALBResult } from 'aws-lambda';
// import { twilioTokenValidator } from '@tech-matters/twilio-worker-auth';

export const handler = async (event: ALBEvent): Promise<ALBResult> => {
  try {
    console.log(JSON.stringify(event));
    // const payload = JSON.parse(event.body || '{}');
    console.debug(`custom-integrations/uscr-dispatcher: called with event ${event}`);
  } catch (err) {
    console.error(`custom-integrations/uscr-dispatcher: error: `, err);
  }

  return {
    statusCode: 200,
  };
};

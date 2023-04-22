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

export const getInternalToken = async (): Promise<string> => {
  let internalToken = process.env.INTERNAL_JWT_TOKEN_SECRET;

  if (!internalToken) {
    //TODO: load from ssm
  }

  //TODO: remove ! after implementing ssm
  return internalToken!;
};

export const getAuthToken = async (accountSid: string): Promise<string> => {
  let authToken = process.env[`TWILIO_AUTH_TOKEN_${accountSid}`];

  if (!authToken) {
    //TODO: load from ssm
  }

  //TODO: remove ! after implementing ssm
  return authToken!;
};

export const getSecret = async (accountSid: string): Promise<string> => {
  const internalToken = await getInternalToken();
  const authToken = await getAuthToken(accountSid);

  return `${internalToken}:${authToken}`;
};

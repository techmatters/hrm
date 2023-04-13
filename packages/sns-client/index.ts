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

import { SNS } from 'aws-sdk';

/**
 * I extracted this out to a library because there isn't a great way to do overrides
 * for the localstack env globally that I could find. It is a little weird, but
 * drys up the setup a bit.
 *
 * Totally open to other ideas here.
 * (rbd 10-10-22)
 */
const getSnsConf = () => {
  const snsConfig: {
    endpoint?: string;
  } = process.env.SNS_ENDPOINT ? { endpoint: process.env.SNS_ENDPOINT } : {};

  return snsConfig;
};

export const sns = new SNS(getSnsConf());

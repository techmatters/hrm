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

import { config } from './config';

type ConfigParams = {
  configId?: string;
  indexType: string;
};

// We will likely add complexity to this in the future. I started out using dynamic
// imports but lambdas really don't like those. So for now we just have a single
// config file that we load and then we can use the configId/indexType to get the
// config we need for each ES function wrapper.
export const getConfig = async ({ configId = 'default', indexType }: ConfigParams) => {
  return config[configId][indexType];
};

export default getConfig;

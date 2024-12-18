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

import { generate } from '@tech-matters/generate-ai-training-set';
import { handleSignals } from './handleSignals';

const environment = process.argv[2];
const helplineCodes = process.argv[3].split(';');
const targetBucket = process.argv[4];
// const sourceBucket = process.argv[5];

generate(environment, helplineCodes, targetBucket).catch(error => {
  console.error(error);
});
handleSignals(async () => undefined).catch(error => {
  console.error(error);
});

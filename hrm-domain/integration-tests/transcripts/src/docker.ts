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

import Docker from 'dockerode';

const docker = new Docker();

export const runContainer = async (
  imageName: string,
  env: Record<string, string>,
  {
    copyEnvironmentVariables = true,
    maxMemoryMb,
  }: { copyEnvironmentVariables?: boolean; maxMemoryMb?: number } = {},
) => {
  console.log('Starting image:', imageName, 'Env:', env);
  const [output, container] = await docker.run(imageName, [], process.stdout, {
    Env: Object.entries({
      ...(copyEnvironmentVariables ? process.env : {}),
      ...env,
    }).map(([key, value]) => `${key}=${value}`),
    HostConfig: {
      NetworkMode: 'hrm_default',
      ...(maxMemoryMb && {
        Memory: 1024 * 1024 * maxMemoryMb,
      }),
    },
  });
  await container.remove();

  if (output.StatusCode !== 0) {
    throw new Error(
      `Container from image ${imageName} exited with status code ${output.StatusCode}`,
    );
  }
};

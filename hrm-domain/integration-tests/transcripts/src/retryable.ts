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

export const retryable = <TParams, T>(
  action: (params: TParams) => Promise<T>,
  failValue: T = undefined,
) => {
  const retryableAction = async (params: TParams, retryCount = 0): Promise<T> => {
    let result: T = failValue;
    try {
      result = await action(params);
    } catch (err) {
      if (retryCount < 60) {
        await new Promise(resolve => setTimeout(resolve, 250));
        return retryableAction(params, retryCount + 1);
      }
    }

    return result;
  };
  return retryableAction;
};

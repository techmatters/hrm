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

export const logger = ({
  message,
  severity,
}: {
  message: string;
  severity: 'info' | 'warn' | 'error';
}) => {
  if (severity === 'error') {
    console.error('custom-integrations/uscr-dispatcher error: ', message);
  }

  if (severity === 'warn') {
    console.warn('custom-integrations/uscr-dispatcher warn: ', message);
  }

  console.info('custom-integrations/uscr-dispatcher info: ', message);
};

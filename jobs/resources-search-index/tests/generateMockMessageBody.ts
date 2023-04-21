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

const accountSids = ['ACCOUNT_1', 'ACCOUNT_2'];

export const generateMockMessageBody = () => {
  const accountSid = accountSids[Math.floor(Math.random() * accountSids.length)];
  const resourceId = Math.floor(Math.random() * 1000);
  return {
    accountSid,
    jobType: 'resources-search-index',
    document: {
      id: `RESOURCE_${resourceId}`,
      name: `Resource ${resourceId}`,
      attributes: [
        { key: 'testAttribute', value: 'testValue', language: 'Klingon', info: { qa: 'pla' } },
      ],
    },
  };
};

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

// eslint-disable-next-line import/no-extraneous-dependencies,prettier/prettier
import type { Mockttp } from 'mockttp';
import { randomUUID } from 'node:crypto';

export const mockAllSns = async (mockttp: Mockttp) => {
  await mockttp
    .forPost(/http:\/\/mock-sns(.*)/)
    .always()
    .thenReply(
      200,
      `<a><PublishResult>
<MessageId>${randomUUID()}</MessageId>
</PublishResult></a>`,
    );
  console.info('Mocked SNS on mock-ssm');
};

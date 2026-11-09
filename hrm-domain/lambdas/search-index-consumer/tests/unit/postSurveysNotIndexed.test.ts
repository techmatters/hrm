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

import {
  hrmIndexConfiguration,
  HRM_CONTACTS_INDEX_TYPE,
} from '@tech-matters/hrm-search-config';

const POST_SURVEY_ANSWER = 'a post survey answer that must never be searchable';

describe('contact index document', () => {
  test('does not include post survey data', () => {
    const document = hrmIndexConfiguration.convertToIndexDocument(
      {
        entityType: 'contact',
        operation: 'update',
        transcript: null,
        contact: {
          id: '1',
          accountSid: 'ACxxx',
          createdAt: new Date().toISOString(),
          rawJson: { callType: 'Child calling about self' } as any,
          csamReports: [],
          postSurveys: [
            {
              id: '1',
              contactTaskId: 'WT-contact',
              taskId: 'WT-survey',
              data: { comments: POST_SURVEY_ANSWER },
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        },
      },
      `ACxxx-${HRM_CONTACTS_INDEX_TYPE}`,
    );

    expect(JSON.stringify(document)).not.toContain(POST_SURVEY_ANSWER);
  });
});

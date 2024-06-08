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

import { HrmAccountId, newErr, newOkFromData } from '@tech-matters/types';
import { CaseService, searchCases } from './caseService';
import { publishCaseToSearchIndex } from '../jobs/search/publishToSearchIndex';
import { maxPermissions } from '../permissions';
import {
  AsyncProcessor,
  SearchFunction,
  processInBatch,
} from '@tech-matters/batch-processing';
import formatISO from 'date-fns/formatISO';

export const reindexCases = async (
  accountSid: HrmAccountId,
  dateFrom: string,
  dateTo: string,
) => {
  try {
    const filters = {
      updatedAt: {
        from: formatISO(new Date(dateFrom)),
        to: formatISO(new Date(dateTo)),
      },
    };

    const searchFunction: SearchFunction<CaseService> = async limitAndOffset => {
      const res = await searchCases(
        accountSid,
        {
          limit: limitAndOffset.limit.toString(),
          offset: limitAndOffset.offset.toString(),
        },
        {},
        { filters },
        maxPermissions,
      );
      return { records: res.cases as CaseService[], count: res.count };
    };

    const asyncProcessor: AsyncProcessor<CaseService, void> = async casesResult => {
      const promises = casesResult.records.map(caseObj => {
        return publishCaseToSearchIndex({
          accountSid,
          case: caseObj,
          operation: 'index',
        });
      });

      await Promise.all(promises);
    };

    await processInBatch(searchFunction, asyncProcessor);

    return newOkFromData('Successfully indexed contacts');
  } catch (error) {
    console.error('Error reindexing contacts', error);
    return newErr({ error, message: 'Error reindexing contacts' });
  }
};

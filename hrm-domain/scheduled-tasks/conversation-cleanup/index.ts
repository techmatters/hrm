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

import { AccountSID } from '@tech-matters/types';
import { getClient } from '@tech-matters/twilio-client';
import {
  getCachedParameters,
  getSsmParameter,
  loadSsmCache,
  SsmParameterNotFound,
} from '@tech-matters/ssm-cache';
import subDays from 'date-fns/subDays';

const MAX_CLEANUP_JOB_RETENTION_DAYS = 3650;

const MAX_ACTIVE_CONVERSATION_HOURS = 24;

const hrmEnv = process.env.NODE_ENV;

/**
 * Get the number of days to retain cleanup jobs for a given account
 * @param accountSid
 * @returns number of days to retain cleanup jobs
 */
const getCleanupRetentionDays = async (accountSid): Promise<number | undefined> => {
  let ssmRetentionDays: number;
  try {
    ssmRetentionDays =
      parseInt(
        await getSsmParameter(
          `/${process.env.NODE_ENV}/hrm/${accountSid}/transcript_retention_days`,
        ),
      ) || MAX_CLEANUP_JOB_RETENTION_DAYS;
    console.debug(
      `SSM parameter for transcript retention days set to ${ssmRetentionDays} for account ${accountSid}, so using that`,
    );
  } catch (err) {
    if ((err as any) instanceof SsmParameterNotFound) {
      console.debug(
        `SSM parameter for transcript retention days not set for account ${accountSid}, so using default ${MAX_CLEANUP_JOB_RETENTION_DAYS}`,
      );
    } else {
      console.error(
        `Error trying to fetch /${process.env.NODE_ENV}/hrm/${accountSid}/transcript_retention_days ${err}, using default`,
        err,
      );
    }
    ssmRetentionDays = MAX_CLEANUP_JOB_RETENTION_DAYS;
  }

  // For now we are limiting the retention days to 365 days for all jobs and allowing for a
  // global override on a per account basis. This may need to epand to be more granular in the
  // future.
  return Math.min(MAX_CLEANUP_JOB_RETENTION_DAYS, ssmRetentionDays);
};

const PAGE_SIZE = 40;

type ConversationListResponse = {
  conversations: { sid: string }[];
};

const removeConversationsBySids = async (
  accountSid: AccountSID,
  conversationSids: string[],
  attemptToClose: boolean,
) => {
  const twilioClient = await getClient({ accountSid });
  // eslint-disable-next-line @typescript-eslint/no-loop-func
  const removePromises = conversationSids.map(async sid => {
    if (attemptToClose) {
      console.debug(`Closing conversation ${sid} from account ${accountSid}`);
      try {
        const result = await twilioClient.conversations.v1.conversations
          .get(sid)
          .update({ state: 'closed' });
        if (result.state === 'closed') {
          console.debug(`Closed conversation ${sid} from account ${accountSid}`);
          return;
        }
      } catch (e) {
        console.warn(
          `Error occurred while closing conversation ${sid} from account ${accountSid}, removing instead`,
          e,
        );
      }
    }
    console.debug(`Removing conversation ${sid} from account ${accountSid}`);
    try {
      const result = await twilioClient.conversations.v1.conversations.get(sid).remove();
      if (result) {
        console.debug(`Removed conversation ${sid} from account ${accountSid}`);
      } else {
        console.warn(
          `Failed to remove conversation ${sid} from account ${accountSid}. Method returned false`,
        );
      }
    } catch (err) {
      console.warn(
        `Failed to remove conversation ${sid} from account ${accountSid}. Error thrown:`,
        err,
      );
    }
  });
  return Promise.all(removePromises);
};
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const ITERATION_DELAY = 2000;
const MAX_ITERATIONS = 1000;
const removeOldConversations = async (
  accountSid: AccountSID,
  retentionDays: number,
  errorIfFound: boolean = false,
  state?: string,
) => {
  const endDate = subDays(new Date(), retentionDays);
  const authToken = await getSsmParameter(`/${hrmEnv}/twilio/${accountSid}/auth_token`);
  let conversationsRetrieved = PAGE_SIZE;
  let iteration = 0;
  // Whilst we can filter conversations using the API, we can just repeatedly pull the first page.
  // This is because everything we pull will no longer be valid for the query after we process it, so repeating the query will get new result set
  // If we introduce filtering that needs to be done on the client, we will need to start paging through results.
  // This is because otherwise we could request 100 results that all get filtered on the client, but repeating the same query will just keep getting those same 100 results back.
  while (conversationsRetrieved >= PAGE_SIZE && iteration++ < 100) {
    const start = Date.now();
    // Only the REST API offers the option to filter by date / state
    const response = await fetch(
      `https://conversations.twilio.com/v1/Conversations?PageSize=${PAGE_SIZE}&EndDate=${endDate.toISOString()}${
        state ? `&State=${state}` : ''
      }`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString(
            'base64',
          )}`,
        },
      },
    );
    if (!response.ok) {
      throw new Error(
        `Error retrieving conversations from Twilio API for URL ${response.url} Status: ${
          response.status
        }: ${await response.text()}`,
      );
    }
    const body = (await response.json()) as ConversationListResponse;
    const { conversations } = body;
    conversationsRetrieved = conversations.length;
    const conversationSids = conversations.map(c => c.sid);
    if (conversationSids.length > 0) {
      if (errorIfFound) {
        console.error(
          `POSSIBLE STALE CONVERSATIONS DETECTED! ${
            conversationSids.length
          } conversations found older than ${retentionDays}${
            state ? ` in a '${state}' state` : ''
          } for account ${accountSid}:`,
          conversationSids,
        );
      }
      await removeConversationsBySids(
        accountSid,
        conversationSids,
        state && state !== 'closed',
      );
    }
    // This prevents us exceeding the twilio imposed rate limit
    const duration = Date.now() - start;
    if (duration < ITERATION_DELAY) {
      await delay(ITERATION_DELAY - duration);
    }
  }
  if (iteration >= MAX_ITERATIONS) {
    console.warn(
      `Repeated the pull for 100 conversations for cleanup for account ${accountSid} ${iteration} ${
        state ? `(state '${state}')` : ''
      } times, this could indicate an issue with the cleanup logic`,
    );
  }
};

/**
 * Cleanup all pending cleanup jobs
 * @returns void
 * @throws Error
 */
export const cleanupConversations = async (): Promise<void> => {
  await loadSsmCache({
    configs: [
      {
        path: `/${process.env.NODE_ENV}/twilio`,
        regex: /\/.*\/account_sid/,
      },
      {
        path: `/${process.env.NODE_ENV}/twilio`,
        regex: /\/.*\/auth_token/,
      },
      {
        path: `/${process.env.NODE_ENV}/hrm`,
        regex: /\/.*\/transcript_retention_days/,
      },
    ],
    cacheDurationMilliseconds: 1000 * 60 * 60, // 1 hour
  });

  const accountSids: AccountSID[] = Object.values(
    getCachedParameters(/^\/[^\/]+\/twilio\/[^\/]+\/account_sid$/),
  ) as AccountSID[];

  console.info(`Cleaning up contact jobs for accounts:`, accountSids);

  for (const accountSid of accountSids) {
    console.info(`Checking for possible stuck conversations for account:`, accountSid);
    await removeOldConversations(
      accountSid,
      MAX_ACTIVE_CONVERSATION_HOURS,
      true,
      'active',
    );
    await removeOldConversations(
      accountSid,
      MAX_ACTIVE_CONVERSATION_HOURS,
      true,
      'inactive',
    );
    console.info(`Removing expired conversations for account:`, accountSid);
    await removeOldConversations(accountSid, await getCleanupRetentionDays(accountSid));
  }
};

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

import asyncHandler from '../async-handler';
import {
  Contact,
  getContactById,
  PatchPayload,
  WithLegacyCategories,
} from './contactService';
import { actionsMaps } from '../permissions';
import { getClient } from '@tech-matters/twilio-client';
import { isTwilioTaskTransferTarget } from '@tech-matters/twilio-client/dist/isTwilioTaskTransferTarget';
import createError from 'http-errors';
import { getCase } from '../case/caseService';

const canPerformActionOnContact = (
  action: (typeof actionsMaps.contact)[keyof typeof actionsMaps.contact],
  additionalValidationForFinalized: (
    contact: WithLegacyCategories<Contact>,
    req: any,
  ) => Promise<boolean> = () => Promise.resolve(true),
) =>
  asyncHandler(async (req, res, next) => {
    if (!req.isAuthorized()) {
      const { accountSid, user, can, body } = req;
      const { contactId } = req.params;

      try {
        const contactObj = await getContactById(accountSid, contactId, {
          can: req.can,
          user,
        });
        if (!contactObj) {
          // This is a dirty hack that relies on the catch block in the try/catch below to return a 404
          throw new Error('contact not found');
        }
        if (contactObj.finalizedAt) {
          if (
            (await additionalValidationForFinalized(contactObj, req)) &&
            can(user, action, contactObj)
          ) {
            req.authorize();
          } else {
            req.unauthorize();
          }
        } else {
          // If there is no finalized date, then the contact is a draft and can only be edited by the worker who created it or the one who owns it.
          // Offline contacts potentially need to be edited by a creator that won't own them.
          // Transferred tasks need to be edited by an owner that didn't create them.
          if (
            contactObj.createdBy === user.workerSid ||
            contactObj.twilioWorkerId === user.workerSid
          ) {
            req.authorize();
          } else {
            // It the contact record doesn't show this user as the contact owner, but Twilio shows that they are having the associated task transferred to them, permit the edit
            // Long term it's wrong for HRM to be verifying this itself - we should probably initiate updates for the contact record from the backend transfer logic rather than Flex in future.
            // Then HRM just needs to validate the request is coming from a valid backend service with permission to make the edit.
            const twilioClient = await getClient({
              accountSid,
              authToken: process.env[`TWILIO_AUTH_TOKEN_${accountSid}`],
            });
            if (
              await isTwilioTaskTransferTarget(
                twilioClient,
                body?.taskId,
                contactObj.taskId,
                user.workerSid,
              )
            ) {
              req.authorize();
            } else {
              req.unauthorize();
            }
          }
        }
      } catch (err) {
        if (
          err instanceof Error &&
          err.message.toLowerCase().includes('contact not found')
        ) {
          throw createError(404);
        } else {
          console.error('Failed to authorize contact editing', err);
          throw createError(500);
        }
      }
    }

    next();
  });

const checkFinalizedContactEditsOnlyChangeForm = async (
  contact: Contact,
  { body }: any,
): Promise<boolean> => {
  const updatedProps = Object.keys(body ?? {}) as (keyof PatchPayload)[];
  return updatedProps.every(prop => prop === 'rawJson' || prop === 'referrals');
};

export const canPerformEditContactAction = canPerformActionOnContact(
  actionsMaps.contact.EDIT_CONTACT,
  checkFinalizedContactEditsOnlyChangeForm,
);

const canRemoveFromCase = async (
  originalCaseId: string,
  { can, user, accountSid },
): Promise<boolean> => {
  if (originalCaseId) {
    const originalCaseObj = await getCase(parseInt(originalCaseId), accountSid, {
      can,
      user,
    });
    if (!originalCaseObj) return true; // Allow to disconnect from non existent case I guess
    return can(user, actionsMaps.case.UPDATE_CASE_CONTACTS, originalCaseObj);
  }
  return true;
};

const canConnectContact = canPerformActionOnContact(
  actionsMaps.contact.ADD_CONTACT_TO_CASE,
  async (
    { caseId: originalCaseId }: WithLegacyCategories<Contact>,
    { can, user, accountSid, body: { caseId: targetCaseId } },
  ) => {
    if (!(await canRemoveFromCase(originalCaseId, { can, user, accountSid }))) {
      return false;
    }
    const targetCaseObj = await getCase(parseInt(targetCaseId), accountSid, {
      can,
      user,
    });
    if (!targetCaseObj) throw createError(404);
    return can(user, actionsMaps.case.UPDATE_CASE_CONTACTS, targetCaseObj);
  },
);

export const canDisconnectContact = canPerformActionOnContact(
  actionsMaps.contact.REMOVE_CONTACT_FROM_CASE,
  async ({ caseId }: WithLegacyCategories<Contact>, { can, user, accountSid }) =>
    canRemoveFromCase(caseId, { can, user, accountSid }),
);

// TODO: Remove when we start disallowing disconnecting contacts via the connect endpoint
export const canChangeContactConnection = async (req, res, next) => {
  if (req.body.caseId) {
    return canConnectContact(req, res, next);
  } else {
    return canDisconnectContact(req, res, next);
  }
};

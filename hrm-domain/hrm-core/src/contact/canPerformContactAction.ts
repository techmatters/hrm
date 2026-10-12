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
import { Contact, getContactById, PatchPayload } from './contactService';
import { actionsMaps } from '../permissions';
import { getClient } from '@tech-matters/twilio-client';
import { isTwilioTaskTransferTarget } from '@tech-matters/twilio-client';
import createError from 'http-errors';
import { getCase } from '../case/caseService';
import type { ActionsForTK } from '../permissions/actions';

const permitIfAdditionalValidationPasses = async (
  req: any,
  contact: Contact,
  additionalValidation: (contact: Contact, req: any) => Promise<boolean>,
  action: string,
) => {
  if (await additionalValidation(contact, req)) {
    console.debug(
      `[Permission - PERMITTED] User ${req.user.workerSid} is permitted to perform ${action} on contact ${contact.accountSid}/${contact.id}`,
    );
    req.permit();
  } else {
    console.debug(
      `[Permission - BLOCKED] User ${req.user.workerSid} is not permitted to perform ${action} on contact ${contact.accountSid}/${contact.id} - additional validation failure`,
    );
    req.block();
  }
};

const canPerformActionOnContact = (
  action: ActionsForTK<'contact'>,
  additionalValidation: (contact: Contact, req: any) => Promise<boolean> = () =>
    Promise.resolve(true),
) =>
  asyncHandler(async (req, res, next) => {
    if (!req.isPermitted()) {
      const { hrmAccountId, user, can, body, query } = req;
      const { contactId } = req.params;

      try {
        const contactObj = await getContactById(hrmAccountId, contactId, req);
        if (!contactObj) {
          // This is a dirty hack that relies on the catch block in the try/catch below to return a 404
          throw new Error('contact not found');
        }
        req.permissionCheckContact = contactObj;
        if (contactObj.finalizedAt || action !== actionsMaps.contact.EDIT_CONTACT) {
          if (can(user, action, contactObj)) {
            await permitIfAdditionalValidationPasses(
              req,
              contactObj,
              additionalValidation,
              action,
            );
          } else {
            console.debug(
              `[Permission - BLOCKED] User ${user.workerSid} is not permitted to perform ${action} on contact ${hrmAccountId}/${contactId} - rules failure`,
            );
            if (action === actionsMaps.contact.VIEW_CONTACT) {
              // This is a dirty hack that relies on the catch block in the try/catch below to return a 404
              throw new Error('contact not found');
            } else {
              req.block();
            }
          }
        } else {
          // Cannot finalize an offline task with a placeholder taskId.
          // A real task needs to have been created and it's sid assigned to the contact before it can be finalized (or whilst it is finalized)
          if (
            body?.taskId?.startsWith('offline-contact-task-') &&
            query?.finalize === 'true'
          ) {
            console.debug(
              `[Permission - BLOCKED] User ${user.workerSid} is not permitted to perform ${action} on contact ${hrmAccountId}/${contactId} - finalize offline task attempt`,
            );
            req.block();
          }
          // If there is no finalized date, then the contact is a draft and can only be edited by the worker who created it or the one who owns it, or those with EDIT_INPROGRESS_CONTACT permission.
          // Should we remove the hardcoded checks now we have the permission? Without the hardcoded allows, an incorrect permission config could break Aselo
          // Offline contacts potentially need to be edited by a creator that won't own them.
          // Transferred tasks need to be edited by an owner that didn't create them.
          if (
            contactObj.createdBy === user.workerSid ||
            contactObj.twilioWorkerId === user.workerSid ||
            can(user, actionsMaps.contact.EDIT_INPROGRESS_CONTACT, contactObj)
          ) {
            await permitIfAdditionalValidationPasses(
              req,
              contactObj,
              additionalValidation,
              action,
            );
          } else {
            // It the contact record doesn't show this user as the contact owner, but Twilio shows that they are having the associated task transferred to them, permit the edit
            // Long term it's wrong for HRM to be verifying this itself - we should probably initiate updates for the contact record from the backend transfer logic rather than Flex in future.
            // Then HRM just needs to validate the request is coming from a valid backend service with permission to make the edit.
            const accountSid = user.accountSid;
            const twilioClient = await getClient({
              accountSid,
            });
            const isTransferTarget = await isTwilioTaskTransferTarget(
              twilioClient,
              body?.taskId,
              contactObj.taskId,
              user.workerSid,
            );
            if (isTransferTarget) {
              await permitIfAdditionalValidationPasses(
                req,
                contactObj,
                additionalValidation,
                action,
              );
            } else {
              console.debug(
                `[Permission - BLOCKED] User ${user.workerSid} is not permitted to perform ${action} on contact ${hrmAccountId}/${contactId} - hardcoded draft contact edit rules failure`,
              );
              req.block();
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.message.toLowerCase().includes('not found')) {
          throw createError(404);
        } else {
          console.error('Failed to permit contact editing', err);
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
  if (!contact.finalizedAt) return true;
  const updatedProps = Object.keys(body ?? {}) as (keyof PatchPayload)[];
  return updatedProps.every(prop => prop === 'rawJson' || prop === 'referrals');
};

export const canPerformEditContactAction = canPerformActionOnContact(
  actionsMaps.contact.EDIT_CONTACT,
  checkFinalizedContactEditsOnlyChangeForm,
);

export const canPerformViewContactAction = canPerformActionOnContact(
  actionsMaps.contact.VIEW_CONTACT,
);

const canRemoveFromCase = async (
  originalCaseId: string,
  { can, user, hrmAccountId },
): Promise<boolean> => {
  if (originalCaseId) {
    const originalCaseObj = await getCase(originalCaseId, hrmAccountId, {
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
    { caseId: originalCaseId }: Contact,
    { can, user, hrmAccountId, body: { caseId: targetCaseId } },
  ) => {
    if (
      !(await canRemoveFromCase(originalCaseId, {
        can,
        user,
        hrmAccountId,
      }))
    ) {
      return false;
    }
    const targetCaseObj = await getCase(targetCaseId, hrmAccountId, {
      user,
    });
    if (!targetCaseObj) throw createError(404);
    return can(user, actionsMaps.case.UPDATE_CASE_CONTACTS, targetCaseObj);
  },
);

export const canDisconnectContact = canPerformActionOnContact(
  actionsMaps.contact.REMOVE_CONTACT_FROM_CASE,
  async ({ caseId }: Contact, req) => canRemoveFromCase(caseId, req),
);

// TODO: Remove when we start disallowing disconnecting contacts via the connect endpoint
export const canChangeContactConnection = async (req, res, next) => {
  if (req.body.caseId) {
    return canConnectContact(req, res, next);
  } else {
    return canDisconnectContact(req, res, next);
  }
};

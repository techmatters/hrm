"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const permissions_1 = require("../permissions");
const types_1 = require("@tech-matters/types");
const http_errors_1 = __importDefault(require("http-errors"));
const contactService_1 = require("./contactService");
const canPerformContactAction_1 = require("./canPerformContactAction");
const newContactRouter = (isPublic) => {
    const contactsRouter = (0, permissions_1.SafeRouter)();
    // Public only endpoints
    if (isPublic) {
        contactsRouter.get('/byTaskSid/:taskSid', permissions_1.publicEndpoint, async (req, res) => {
            const { hrmAccountId, user, can } = req;
            const { taskSid } = req.params;
            const contact = await (0, contactService_1.getContactByTaskId)(hrmAccountId, taskSid, {
                can: req.can,
                user,
            });
            console.info(`[Data Access Audit] Account:${hrmAccountId}, User: ${user.workerSid}, Action: Contact read by task sid, taskSid: ${taskSid}`);
            if (!contact || !can(user, permissions_1.actionsMaps.contact.VIEW_CONTACT, contact)) {
                throw (0, http_errors_1.default)(404);
            }
            res.json(contact);
        });
        contactsRouter.delete('/:contactId/connectToCase', canPerformContactAction_1.canDisconnectContact, async (req, res) => {
            const { hrmAccountId, user } = req;
            const { contactId } = req.params;
            try {
                const deleteContact = await (0, contactService_1.connectContactToCase)(hrmAccountId, contactId, null, {
                    can: req.can,
                    user,
                });
                res.json(deleteContact);
            }
            catch (err) {
                if (err.message.toLowerCase().includes('violates foreign key constraint') ||
                    err.message.toLowerCase().includes('contact not found')) {
                    throw (0, http_errors_1.default)(404);
                }
                else
                    throw err;
            }
        });
        const searchHandler = async (req, res, next) => {
            try {
                const { hrmAccountId, can, user, permissionRules, query, body } = req;
                // TODO: use better validation
                const { limit, offset } = query;
                const { searchParameters } = body;
                const contactsResponse = await (0, contactService_1.generalisedContactSearch)(hrmAccountId, searchParameters, { limit, offset }, {
                    can,
                    user,
                    permissionRules,
                });
                if ((0, types_1.isErr)(contactsResponse)) {
                    return next((0, types_1.mapHTTPError)(contactsResponse, { InternalServerError: 500 }));
                }
                res.json(contactsResponse.data);
            }
            catch (err) {
                return next((0, http_errors_1.default)(500, err.message));
            }
        };
        // Endpoint used for generalized search powered by ElasticSearch
        contactsRouter.post('/search', permissions_1.publicEndpoint, searchHandler);
        contactsRouter.post('/generalizedSearch', permissions_1.publicEndpoint, searchHandler);
        contactsRouter.post('/:contactId/conversationMedia', permissions_1.publicEndpoint, async (req, res) => {
            const { hrmAccountId, user } = req;
            const { contactId } = req.params;
            try {
                const contact = await (0, contactService_1.addConversationMediaToContact)(hrmAccountId, contactId, req.body, {
                    can: req.can,
                    user,
                });
                res.json(contact);
            }
            catch (err) {
                if (err.message.toLowerCase().includes('contact not found')) {
                    throw (0, http_errors_1.default)(404);
                }
                else
                    throw err;
            }
        });
    }
    // example: curl -XPOST -H'Content-Type: application/json' localhost:3000/contacts -d'{"hi": 2}'
    contactsRouter.post('/', permissions_1.publicEndpoint, async (req, res) => {
        const getCreatedBy = ({ body, user }) => {
            if (isPublic) {
                // Take the createdBy specified in the body if this is being created from a backend system, otherwise force use of the authenticated user's workerSid
                return user.isSystemUser ? body.createdBy : user.workerSid;
            }
            // Take the createdBy specified in the body since this is being created from a backend system
            return body.createdBy;
        };
        const { hrmAccountId, user, body, permissionRules } = req;
        const contact = await (0, contactService_1.createContact)(hrmAccountId, getCreatedBy({ body, user }), body, { permissionRules, can: req.can, user });
        res.json(contact);
    });
    contactsRouter.put('/:contactId/connectToCase', isPublic ? canPerformContactAction_1.canChangeContactConnection : permissions_1.publicEndpoint, async (req, res) => {
        const { hrmAccountId, user } = req;
        const { contactId } = req.params;
        const { caseId } = req.body;
        try {
            const updatedContact = await (0, contactService_1.connectContactToCase)(hrmAccountId, contactId, caseId, {
                can: req.can,
                user,
            });
            res.json(updatedContact);
        }
        catch (err) {
            if (err.message.toLowerCase().includes('violates foreign key constraint') ||
                err.message.toLowerCase().includes('contact not found')) {
                throw (0, http_errors_1.default)(404);
            }
            else
                throw err;
        }
    });
    const validatePatchPayload = ({ body }, res, next) => {
        if (typeof body !== 'object' || Array.isArray(body)) {
            throw (0, http_errors_1.default)(400);
        }
        next();
    };
    contactsRouter.patch('/:contactId', validatePatchPayload, isPublic ? canPerformContactAction_1.canPerformEditContactAction : permissions_1.publicEndpoint, async (req, res) => {
        const { hrmAccountId, user, permissionRules, permissionCheckContact } = req;
        const { contactId } = req.params;
        const finalize = req.query.finalize === 'true'; // Default to false for backwards compatibility
        try {
            const contact = await (0, contactService_1.patchContact)(hrmAccountId, user.workerSid, finalize, contactId, req.body, {
                can: req.can,
                user,
                permissionRules,
                permissionCheckContact,
            });
            res.json(contact);
        }
        catch (err) {
            if (err.message.toLowerCase().includes('contact not found')) {
                throw (0, http_errors_1.default)(404);
            }
            else
                throw err;
        }
    });
    // WARNING: this endpoint MUST be the last one in this router, because it will be used if none of the above regex matches the path
    contactsRouter.get('/:contactId', isPublic ? canPerformContactAction_1.canPerformViewContactAction : permissions_1.publicEndpoint, async (req, res) => {
        const { hrmAccountId, can, user } = req;
        console.info(`[Data Access Audit] Account:${hrmAccountId}, User: ${user.workerSid}, Action: Contact read by task sid, taskSid: ${req.params.contactId}`);
        const contact = await (0, contactService_1.getContactById)(hrmAccountId, req.params.contactId, {
            can: req.can,
            user,
        });
        if (!contact) {
            throw (0, http_errors_1.default)(404);
        }
        if (!req.isPermitted()) {
            if (!can(user, permissions_1.actionsMaps.contact.VIEW_CONTACT, contact)) {
                (0, http_errors_1.default)(401);
            }
        }
        res.json(contact);
    });
    return contactsRouter.expressRouter;
};
exports.default = newContactRouter;

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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = exports.postHandler = void 0;
const types_1 = require("@tech-matters/types");
const validation_1 = require("./validation");
const authentication_1 = require("./authentication");
const hrmService = __importStar(require("./hrm-service"));
const beaconService = __importStar(require("./beacon-service"));
const mapping = __importStar(require("./mapping"));
const alb_handler_1 = require("@tech-matters/alb-handler");
const postHandler = async (event) => {
    try {
        const envResult = (0, validation_1.validateEnvironment)();
        if ((0, types_1.isErr)(envResult)) {
            const message = `${JSON.stringify(envResult.error)} ${envResult.message}`;
            console.error(message);
            return (0, types_1.newErr)({ error: 'InternalServerError', message });
        }
        const payloadResult = (0, validation_1.validatePayload)(JSON.parse(event.body || '{}'));
        if ((0, types_1.isErr)(payloadResult)) {
            const message = `${JSON.stringify(payloadResult.error)} ${payloadResult.message}`;
            console.warn(message);
            return (0, types_1.newErr)({ error: 'InvalidRequestError', message });
        }
        const headersResult = (0, validation_1.validateHeaders)(event.headers);
        if ((0, types_1.isErr)(headersResult)) {
            const message = `${JSON.stringify(headersResult.error)} ${headersResult.message}`;
            console.warn(message);
            return (0, types_1.newErr)({ error: 'InvalidRequestError', message });
        }
        const authResult = await (0, authentication_1.authenticateRequest)({
            accountSid: payloadResult.data.accountSid,
            authHeader: headersResult.data.authToken,
            environment: envResult.data.environment,
        });
        if ((0, types_1.isErr)(authResult)) {
            const message = JSON.stringify(authResult.error) + authResult.message;
            console.warn(message);
            return (0, types_1.newErr)({ error: 'AuthError', message });
        }
        // Get (or create) case associated with the contact so we can track the incident being reported
        const createCaseResult = await hrmService.getOrCreateCase({
            accountSid: payloadResult.data.accountSid,
            casePayload: payloadResult.data.casePayload,
            contactId: payloadResult.data.contactId,
            baseUrl: envResult.data.baseUrl,
            staticKey: authResult.data.staticKey,
        });
        if ((0, types_1.isErr)(createCaseResult)) {
            const message = JSON.stringify(createCaseResult.error) + createCaseResult.message;
            console.error(message);
            return (0, types_1.newErr)({ error: 'InternalServerError', message });
        }
        const { contact, caseObj, sections } = createCaseResult.data;
        // Case already contains a corresponding case entry section, we asume the incident has been created but something went wrong updating HRM. Poller will eventually bring consitency to this case
        if (hrmService.wasPendingIncidentCreated(sections.sections)) {
            console.info('case already has associated incident');
            return (0, types_1.newOk)({ data: {} });
        }
        const incidentParams = mapping.toCreateIncident({
            caseObj: caseObj,
            contact,
        });
        console.info(`Creating incident with the following data:`, incidentParams);
        // Case does not contains a corresponding case entry section, we assume the incident was never reported (this can only happen if Beacon responded with an error)
        const createIncidentResult = await beaconService.createIncident({
            environment: envResult.data.environment,
            incidentParams,
        });
        if ((0, types_1.isErr)(createIncidentResult)) {
            const message = JSON.stringify(createIncidentResult.error) + createIncidentResult.message;
            console.error(message);
            return (0, types_1.newErr)({ error: 'InternalServerError', message });
        }
        console.debug(JSON.stringify(createIncidentResult));
        // Create incident case section to mark this case as "already reported"
        const updateSectionResult = await hrmService.updateAttemptCaseSection({
            accountSid: payloadResult.data.accountSid,
            beaconIncidentId: createIncidentResult.data.pending_incident.id,
            caseId: caseObj.id,
            attemptSection: sections.currentAttempt.caseSection,
            baseUrl: envResult.data.baseUrl,
            staticKey: authResult.data.staticKey,
        });
        if ((0, types_1.isErr)(updateSectionResult)) {
            const message = JSON.stringify(updateSectionResult.error) + updateSectionResult.message;
            console.error(message);
            return (0, types_1.newErr)({ error: 'InternalServerError', message });
        }
        console.info(`new incident reported, incident id ${createIncidentResult.data.pending_incident.id}, case id ${caseObj.id}`);
        return (0, types_1.newOk)({ data: {} });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : JSON.stringify(err);
        console.error(message);
        return (0, types_1.newErr)({ error: 'InternalServerError', message });
    }
};
exports.postHandler = postHandler;
const methodHandlers = {
    POST: exports.postHandler,
};
const handler = async (event) => {
    return (0, alb_handler_1.handleAlbEvent)({
        event,
        methodHandlers,
        mapError: {
            InvalidRequestError: 400,
            AuthError: 401,
            InternalServerError: 500,
        },
    });
};
exports.handler = handler;

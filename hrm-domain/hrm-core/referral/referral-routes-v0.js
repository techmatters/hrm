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
const referralService_1 = require("./referralService");
const referralDataAccess_1 = require("./referralDataAccess");
const http_errors_1 = __importDefault(require("http-errors"));
const date_fns_1 = require("date-fns");
exports.default = () => {
    const referralsRouter = (0, permissions_1.SafeRouter)();
    referralsRouter.post('/', permissions_1.publicEndpoint, async (req, res) => {
        const { hrmAccountId, body } = req;
        if (!body.resourceId || !body.contactId || !(0, date_fns_1.isValid)((0, date_fns_1.parseISO)(body.referredAt))) {
            throw (0, http_errors_1.default)(400, 'Required referral property not present');
        }
        try {
            res.json(await (0, referralService_1.createReferral)()(hrmAccountId, body));
        }
        catch (err) {
            if (err instanceof referralDataAccess_1.DuplicateReferralError) {
                throw (0, http_errors_1.default)(400, err.message);
            }
            if (err instanceof referralDataAccess_1.OrphanedReferralError) {
                throw (0, http_errors_1.default)(404, err.message);
            }
            throw err;
        }
    });
    return referralsRouter.expressRouter;
};

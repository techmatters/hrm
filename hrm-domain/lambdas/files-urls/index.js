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
exports.handler = void 0;
const alb_handler_1 = require("@tech-matters/alb-handler");
const getSignedS3Url_1 = __importDefault(require("./getSignedS3Url"));
const methodHandlers = {
    GET: getSignedS3Url_1.default,
};
const handler = async (event) => {
    return (0, alb_handler_1.handleAlbEvent)({
        event,
        methodHandlers,
        mapError: {
            InvalidObjectTypeError: 400,
            MissingQueryParamsError: 400,
            MissingRequiredQueryParamsError: 400,
            InvalidFileTypeError: 400,
            MissingRequiredFileParamsError: 400,
            CallHrmApiError: 403,
            MethodNotAllowedError: 405,
            InternalServerError: 500,
        },
    });
};
exports.handler = handler;

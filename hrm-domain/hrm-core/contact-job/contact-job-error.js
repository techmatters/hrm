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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContactJobCleanupError = exports.ContactJobPollerError = exports.ContactJobCompleteProcessorError = void 0;
class ContactJobCompleteProcessorError extends Error {
    payload;
    constructor(message, payload) {
        super(message);
        this.name = 'ContactJobCompleteProcessorError';
        this.payload = payload;
    }
}
exports.ContactJobCompleteProcessorError = ContactJobCompleteProcessorError;
class ContactJobPollerError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ContactJobPollerError';
    }
}
exports.ContactJobPollerError = ContactJobPollerError;
class ContactJobCleanupError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ContactJobCleanupError';
    }
}
exports.ContactJobCleanupError = ContactJobCleanupError;

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
const handleSignals_1 = require("./handleSignals");
const conversation_cleanup_1 = require("@tech-matters/conversation-cleanup");
const featureFlags_1 = require("@tech-matters/hrm-core/featureFlags");
const gracefulExit = async () => {
    //Only a Twilio and AWS client is used, so nothing to do here.
};
if (featureFlags_1.enableConversationsCleanup) {
    (0, conversation_cleanup_1.cleanupConversations)();
    (0, handleSignals_1.handleSignals)(gracefulExit);
}
else {
    console.debug('enableCleanupJobs not set, skipping conversation cleanup.');
}

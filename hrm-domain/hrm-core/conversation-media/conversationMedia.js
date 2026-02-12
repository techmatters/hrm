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
exports.updateConversationMediaSpecificData = exports.getConversationMediaByContactId = exports.getConversationMediaById = exports.createConversationMedia = exports.isTwilioStoredMedia = exports.isS3StoredConversationMedia = exports.isS3StoredRecording = exports.isS3StoredTranscriptPending = exports.isS3StoredTranscript = exports.S3ContactMediaType = void 0;
var conversationMediaDataAccess_1 = require("./conversationMediaDataAccess");
Object.defineProperty(exports, "S3ContactMediaType", { enumerable: true, get: function () { return conversationMediaDataAccess_1.S3ContactMediaType; } });
Object.defineProperty(exports, "isS3StoredTranscript", { enumerable: true, get: function () { return conversationMediaDataAccess_1.isS3StoredTranscript; } });
Object.defineProperty(exports, "isS3StoredTranscriptPending", { enumerable: true, get: function () { return conversationMediaDataAccess_1.isS3StoredTranscriptPending; } });
Object.defineProperty(exports, "isS3StoredRecording", { enumerable: true, get: function () { return conversationMediaDataAccess_1.isS3StoredRecording; } });
Object.defineProperty(exports, "isS3StoredConversationMedia", { enumerable: true, get: function () { return conversationMediaDataAccess_1.isS3StoredConversationMedia; } });
Object.defineProperty(exports, "isTwilioStoredMedia", { enumerable: true, get: function () { return conversationMediaDataAccess_1.isTwilioStoredMedia; } });
Object.defineProperty(exports, "createConversationMedia", { enumerable: true, get: function () { return conversationMediaDataAccess_1.create; } });
Object.defineProperty(exports, "getConversationMediaById", { enumerable: true, get: function () { return conversationMediaDataAccess_1.getById; } });
Object.defineProperty(exports, "getConversationMediaByContactId", { enumerable: true, get: function () { return conversationMediaDataAccess_1.getByContactId; } });
Object.defineProperty(exports, "updateConversationMediaSpecificData", { enumerable: true, get: function () { return conversationMediaDataAccess_1.updateSpecificData; } });

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
exports.isS3StoredConversationMedia = exports.isS3StoredRecording = exports.isS3StoredTranscriptPending = exports.isS3StoredTranscript = exports.isTwilioStoredMedia = exports.S3ContactMediaType = void 0;
var S3ContactMediaType;
(function (S3ContactMediaType) {
    S3ContactMediaType["RECORDING"] = "recording";
    S3ContactMediaType["TRANSCRIPT"] = "transcript";
    S3ContactMediaType["SCRUBBED_TRANSCRIPT"] = "scrubbed-transcript";
})(S3ContactMediaType || (exports.S3ContactMediaType = S3ContactMediaType = {}));
const isTwilioStoredMedia = (m) => m.storeType === 'twilio';
exports.isTwilioStoredMedia = isTwilioStoredMedia;
const isS3StoredTranscript = (m) => 
// eslint-disable-next-line @typescript-eslint/no-use-before-define
m.storeType === 'S3' && m.storeTypeSpecificData?.type === S3ContactMediaType.TRANSCRIPT;
exports.isS3StoredTranscript = isS3StoredTranscript;
const isS3StoredTranscriptPending = (m) => (0, exports.isS3StoredTranscript)(m) && !m.storeTypeSpecificData?.location;
exports.isS3StoredTranscriptPending = isS3StoredTranscriptPending;
const isS3StoredRecording = (m) => m.storeType === 'S3' && m.storeTypeSpecificData?.type === S3ContactMediaType.RECORDING;
exports.isS3StoredRecording = isS3StoredRecording;
const isS3StoredConversationMedia = (m) => (0, exports.isS3StoredTranscript)(m) || (0, exports.isS3StoredRecording)(m);
exports.isS3StoredConversationMedia = isS3StoredConversationMedia;

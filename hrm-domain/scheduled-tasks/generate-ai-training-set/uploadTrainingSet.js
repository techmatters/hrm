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
exports.uploadTrainingSetDocument = exports.uploadStreamAsSingleFile = void 0;
const lib_storage_1 = require("@aws-sdk/lib-storage");
const s3_client_1 = require("@tech-matters/s3-client");
const stream_1 = require("stream");
const fileTimestamp = (date) => date
    .toISOString()
    .replace(/[:-]/g, '')
    .replace(/[T.].+/, '-');
/**
 * This function takes a stream of documents and wraps it in an array to be uploaded as a single file
 */
const buildStreamAsArray = (trainingSetDocumentStream) => {
    const wrappedStream = new stream_1.PassThrough({ objectMode: true });
    wrappedStream.write('[');
    let isFirstDocument = true;
    trainingSetDocumentStream.on('data', doc => {
        if (!isFirstDocument) {
            wrappedStream.write(',');
        }
        else {
            isFirstDocument = false;
        }
        wrappedStream.write(JSON.stringify(doc));
    });
    trainingSetDocumentStream.on('end', () => wrappedStream.end(']'));
    return wrappedStream;
};
const uploadStreamAsSingleFile = async (trainingSetDocumentStream, targetBucket, helplineCode) => {
    const streamAsArray = buildStreamAsArray(trainingSetDocumentStream);
    const upload = new lib_storage_1.Upload({
        client: (0, s3_client_1.getNativeS3Client)(),
        params: {
            Bucket: targetBucket,
            Key: `${helplineCode}/categoryTrainingSet_${fileTimestamp(new Date())}.json`,
            Body: streamAsArray,
        },
    });
    await upload.done();
};
exports.uploadStreamAsSingleFile = uploadStreamAsSingleFile;
const uploadTrainingSetDocument = async (contactId, docJson, targetBucket, helplineCode) => {
    await (0, s3_client_1.putS3Object)({
        bucket: targetBucket,
        key: `${helplineCode}/categoryTrainingSet_${fileTimestamp(new Date())}/contact_${contactId}.json`,
        body: docJson,
    });
};
exports.uploadTrainingSetDocument = uploadTrainingSetDocument;

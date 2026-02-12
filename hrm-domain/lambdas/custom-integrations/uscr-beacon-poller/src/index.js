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
exports.handler = void 0;
const incidentReport_1 = require("./incidentReport");
const config_1 = require("./config");
const apiChunkReader_1 = require("./apiChunkReader");
const caseReport_1 = require("./caseReport");
const lastIncidentReportUpdateSeenSsmKey = `/${process.env.NODE_ENV}/hrm/custom-integration/uscr/${config_1.accountSid}/beacon/latest_incident_report_seen`;
const lastCaseReportUpdateSeenSsmKey = `/${process.env.NODE_ENV}/hrm/custom-integration/uscr/${config_1.accountSid}/beacon/latest_case_report_seen`;
const handler = async ({ apiType, }) => {
    const API_POLL_CONFIGS = {
        caseReport: {
            url: new URL(`${process.env.BEACON_BASE_URL}/api/aselo/case_reports/updates`),
            headers: config_1.beaconHeaders,
            lastUpdateSeenSsmKey: lastCaseReportUpdateSeenSsmKey,
            itemExtractor: (body) => body.case_reports,
            itemProcessor: caseReport_1.addCaseReportSectionsToAseloCase,
            maxItemsInChunk: parseInt(process.env.MAX_CASE_REPORTS_PER_CALL || '1000'),
            maxChunksToRead: parseInt(process.env.MAX_CONSECUTIVE_API_CALLS || '10'),
            itemTypeName: 'case report',
        },
        incidentReport: {
            url: new URL(`${process.env.BEACON_BASE_URL}/api/aselo/incidents/updates`),
            headers: config_1.beaconHeaders,
            lastUpdateSeenSsmKey: lastIncidentReportUpdateSeenSsmKey,
            itemExtractor: (body) => body.incidents,
            itemProcessor: incidentReport_1.addIncidentReportSectionsToAseloCase,
            maxItemsInChunk: parseInt(process.env.MAX_INCIDENT_REPORTS_PER_CALL || '1000'),
            maxChunksToRead: parseInt(process.env.MAX_CONSECUTIVE_API_CALLS || '10'),
            itemTypeName: 'incident report',
        },
    };
    console.info(`[TRACER][${API_POLL_CONFIGS[apiType]?.itemTypeName}] Starting beacon poll: `, apiType);
    await (0, apiChunkReader_1.readApiInChunks)(API_POLL_CONFIGS[apiType]);
    console.info(`[TRACER][${API_POLL_CONFIGS[apiType]?.itemTypeName}] Completed beacon poll: `, apiType);
    return 0;
};
exports.handler = handler;

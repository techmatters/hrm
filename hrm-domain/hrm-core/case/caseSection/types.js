"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isContactRecordTimelineActivity = exports.isContactTimelineActivity = exports.isCaseSectionTimelineActivity = void 0;
const isCaseSectionTimelineActivity = (activity) => activity.activityType === 'case-section';
exports.isCaseSectionTimelineActivity = isCaseSectionTimelineActivity;
const isContactTimelineActivity = (activity) => activity.activityType === 'contact' && typeof activity.activity.id === 'string';
exports.isContactTimelineActivity = isContactTimelineActivity;
const isContactRecordTimelineActivity = (activity) => activity.activityType === 'contact' && typeof activity.activity.id === 'number';
exports.isContactRecordTimelineActivity = isContactRecordTimelineActivity;

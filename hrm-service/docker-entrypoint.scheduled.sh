#!/usr/bin/env sh

if [ -n "$HRM_SCHEDULED_JOB" ]; then
    exec npm run start:${HRM_SCHEDULED_JOB}
else
    exec "$@"
fi
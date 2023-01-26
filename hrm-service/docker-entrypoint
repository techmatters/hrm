#!/usr/bin/env sh

if [ -n "$HRM_RUN_MIGRATIONS" ]; then
  # Execute hrm-service migrations
  node ./db-migrate
  if [ $? -ne 0 ]; then
    echo "Failed to run hrm-service migrations"
    exit 1
  fi

  # Execute resources-service migrations (move once the service lives in it's own container)
  cd ./resources-service
  node ./db-migrate
  if [ $? -ne 0 ]; then
    echo "Failed to run resource-service migrations"
    exit 1
  fi

  cd ..
fi

exec "$@"

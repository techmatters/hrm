#!/usr/bin/env sh
# Copyright (C) 2021-2023 Technology Matters
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published
# by the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see https://www.gnu.org/licenses/.


if [ -n "$HRM_RUN_MIGRATIONS" ]; then
  # Execute hrm-service migrations
  node ./db-migrate
  if [ $? -ne 0 ]; then
    echo "Failed to run hrm-service migrations"
    exit 1
  fi

  # Execute resources-service migrations (move once the service lives in it's own container)
  cd ./resources-domain/resources-service
  node ./db-migrate
  if [ $? -ne 0 ]; then
    echo "Failed to run resource-service migrations"
    exit 1
  fi

  cd ../..
fi

exec "$@"

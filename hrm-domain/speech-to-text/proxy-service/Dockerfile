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

FROM node:22-alpine AS build

ARG task_dir=hrm-domain/speech-to-text/proxy-service

# This is a bit complicated by the need for access to the packages.
# We must have the full repo context for our docker build so we can
# copy the root packages so that the file: based
# dependency in package.json can be resolved
COPY packages /tmp/build/packages
COPY ${task_dir} /tmp/build/${task_dir}
COPY ${task_dir}/../tsconfig.json /tmp/build/${task_dir}/../tsconfig.json
COPY ${task_dir}/../../tsconfig.json /tmp/build/${task_dir}/../../tsconfig.json

COPY package.json package-lock.json tsconfig.json tsconfig.base.json ${task_dir}/tsconfig.build.json /tmp/build/

RUN  cd /tmp/build \
    && npm ci -w ${task_dir} -w packages/* --verbose \
    && npx tsc -b tsconfig.build.json --verbose \
    && mkdir -p /var/task/${task_dir} \
    && cp ${task_dir}/dist/*.js /var/task/ \
    && cp -r packages /var/task/ \
    && cp -r node_modules /var/task/
# COPY ${task_dir}/entrypoint.sh /var/task/entrypoint.sh
# COPY ${task_dir}/licence /app/license

# WORKDIR /app

# COPY package*.json ./
# RUN npm ci

# COPY tsconfig.json ./
# COPY src ./src
# RUN npm run build

FROM node:22-alpine

# WORKDIR /app

COPY --from=build /var/task /var/task
# COPY --from=build /app/license /app/license
# COPY --from=build /app/dist ./dist
# COPY --from=build /app/node_modules ./node_modules
# COPY package.json ./

EXPOSE 3000

# HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
#   CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "dist/index.js"]

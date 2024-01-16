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

FROM node:16-alpine as build

# This is a bit complicated by the need for access to the package.
# We must have the full repo context for our docker build so we can
# copy the hrm-lib package and labmdas folders so that the file: based
# dependency in package.json can be resolved
COPY packages /tmp/build/packages
COPY resources-domain/packages /tmp/build/resources-domain/packages
COPY resources-domain/resources-service /tmp/build/resources-domain/resources-service
COPY resources-domain/tsconfig.json /tmp/build/resources-domain/tsconfig.json
COPY hrm-domain/packages /tmp/build/hrm-domain/packages
COPY hrm-domain/hrm-service /tmp/build/hrm-domain/hrm-core
COPY hrm-domain/hrm-service /tmp/build/hrm-domain/hrm-service
COPY hrm-domain/tsconfig.json /tmp/build/hrm-domain/tsconfig.json
COPY package.json package-lock.json tsconfig.base.json hrm-domain/hrm-service/tsconfig.build.json /tmp/build/

RUN apk add --no-cache rsync \
    && cd /tmp/build \
    && npm ci -w=hrm-domain/hrm-core -w=hrm-domain/hrm-service -w hrm-domain/scheduled-tasks/* -w packages/* -w resources-domain/resources-service -w resources-domain/packages/* \
    && npx tsc -b tsconfig.build.json \
    && cp -r hrm-domain/hrm-service/* /home/node/ \
    && cp -r hrm-domain/hrm-core /home/node/hrm-domain/hrm-core \
    && cp -r hrm-domain/scheduled-tasks /home/node/hrm-domain/scheduled-tasks \
    && cp -r packages /home/node/ \
    && cp -r packages /home/node/ \
    && mkdir -p /home/node/resources-domain/ \
    && cp -r resources-domain/resources-service /home/node/resources-domain/resources-service \
    && cp -r resources-domain/packages /home/node/resources-domain/packages \
    && cp -r node_modules /home/node/

# Ignore errors if node_modules is not present
RUN rsync -a hrm-domain/hrm-service/node_modules/ /home/node/node_modules; exit 0

FROM node:16-alpine
COPY --from=build /home/node /home/node

WORKDIR /home/node


COPY hrm-domain/hrm-service/docker-entrypoint.sh /usr/local/bin/docker-entrypoint
RUN chmod +x /usr/local/bin/docker-entrypoint

ENTRYPOINT ["/usr/local/bin/docker-entrypoint"]

# RUN npm test
USER node

CMD ["/usr/local/bin/npm", "start"]
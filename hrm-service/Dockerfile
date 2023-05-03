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
COPY resources-service /tmp/build/resources-service
COPY hrm-service /tmp/build/hrm-service
COPY package.json package-lock.json tsconfig.base.json tsconfig.build.service.json /tmp/build/

RUN apk add --no-cache rsync \
    && cd /tmp/build \
    && npm ci -w=hrm-service -w packages/* -w resources-service \
    && npx tsc -b tsconfig.build.service.json \
    && cp -r hrm-service/* /home/node/ \
    && cp -r packages /home/node/ \
    && cp -r resources-service /home/node/ \
    && cp -r node_modules /home/node/

# Ignore errors if node_modules is not present
RUN rsync -a hrm-service/node_modules/ /home/node/node_modules; exit 0

FROM node:16-alpine
COPY --from=build /home/node /home/node

WORKDIR /home/node

COPY hrm-service/docker-entrypoint.sh /usr/local/bin/docker-entrypoint
ENTRYPOINT ["/usr/local/bin/docker-entrypoint"]

# RUN npm test
USER node

CMD ["/usr/local/bin/npm", "start"]
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
COPY resources-domain/resources-service /tmp/build/resources-domain/resources-service
COPY resources-domain/tsconfig.json /tmp/build/resources-domain/tsconfig.json
COPY hrm-domain/hrm-service /tmp/build/hrm-domain/hrm-service
COPY hrm-domain/tsconfig.json /tmp/build/hrm-domain/tsconfig.json
COPY package.json package-lock.json tsconfig.base.json tsconfig.build.service.json /tmp/build/

RUN cd /tmp/build \
    && npm ci -w=hrm-domain/hrm-service -w packages/* -w resources-domain/resources-service \
    && npx tsc --verbose -b tsconfig.build.service.json \
    && cp -r hrm-domain/hrm-service/* /home/node/ \
    && cp -r packages /home/node/ \
    && cp -r resources-domain/resources-service /home/node/ \
    && cp -r node_modules /home/node/ \
    && rm -rf /tmp/* \
    && rm -rf /root/.cache \
    && rm -rf /usr/local/share/.cache

WORKDIR /home/node

COPY hrm-domain/hrm-service/docker-entrypoint /usr/local/bin/docker-entrypoint
ENTRYPOINT ["/usr/local/bin/docker-entrypoint"]

# RUN npm test
USER node

CMD ["/usr/local/bin/npm", "start"]
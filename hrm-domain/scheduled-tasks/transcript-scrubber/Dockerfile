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

FROM node:22 AS build
# FROM crprivateaiprod.azurecr.io/deid:cpu-text
ARG task_dir=hrm-domain/scheduled-tasks/transcript-scrubber

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
COPY ${task_dir}/entrypoint.sh /var/task/entrypoint.sh
COPY ${task_dir}/licence /app/license

# Ignore errors if node_modules is not present
RUN rsync -a ${task_dir}/node_modules/ /var/task/node_modules; exit 0

# The added layers from our build increase image size significantly. This flattens the image
# to reduce the size of the final image.
FROM crprivateaiprod.azurecr.io/deid:4.0.0-cpu-text AS final
ENV NODE_VERSION=22.20.0
RUN apt install -y curl
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
ENV NVM_DIR=/root/.nvm
RUN . "$NVM_DIR/nvm.sh" && nvm install ${NODE_VERSION}
RUN . "$NVM_DIR/nvm.sh" && nvm use v${NODE_VERSION}
RUN . "$NVM_DIR/nvm.sh" && nvm alias default v${NODE_VERSION}
ENV PATH="/root/.nvm/versions/node/v${NODE_VERSION}/bin/:${PATH}"
RUN node --version
RUN npm --version
COPY --from=build /var/task /var/task
COPY --from=build /app/license /app/license


WORKDIR /var/task

ENTRYPOINT ["/usr/bin/sh","/var/task/entrypoint.sh"]
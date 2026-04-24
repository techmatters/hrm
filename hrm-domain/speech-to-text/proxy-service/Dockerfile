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
# COPY ${task_dir}/../../tsconfig.json /tmp/build/${task_dir}/../../tsconfig.json
COPY package.json package-lock.json tsconfig.json tsconfig.base.json ${task_dir}/tsconfig.build.json /tmp/build/

RUN  cd /tmp/build \
  && npm ci -w ${task_dir} -w packages/* --verbose \
  && npx tsc -b tsconfig.build.json --verbose \
  && mkdir -p /var/task/dist \
  && cp -r ${task_dir}/dist/* /var/task/dist/ \
  && cp -r packages /var/task/dist/ \
  && cp -r node_modules /var/task/dist/ \
  && cp ${task_dir}/package.json /var/task/


FROM node:22-alpine

COPY --from=build /var/task /var/task

EXPOSE 3000

WORKDIR /var/task

ENV LOCAL_LIMINA_URI="http://localhost:8080"
ENV LOCAL_PYANNOTE_URI="http://localhost:8081"
ENV AUDIO_DIR="/shared/audio"
ENV DIARIZATION_DIR="/shared/diarization"
ENV TRANSCRIPTION_DIR="/shared/transcription"

CMD ["node", "dist/index.js"]

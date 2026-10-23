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

# A lambda can depend on the shared packages in the `packages` folder of its own folder and
# of every parent folder up to the repo root (e.g. hrm-domain/packages and packages for
# hrm-domain/lambdas/custom-integrations/*). COPY cannot walk folders, so this stage copies
# the whole build context and selects those `packages` folders, plus the tsconfig.json files
# along the same path that they extend. The build stage only copies the selection, so its
# cache is only invalidated when those files change, not on any change in the repo.
FROM public.ecr.aws/lambda/nodejs:22 as sources

ARG lambda_dir

COPY . /context
RUN mkdir -p /sources \
    && sh /context/lambdas/copy-ancestor-dirs.sh /context ${lambda_dir} /sources packages tsconfig.json > /sources/.ancestor-workspaces

FROM public.ecr.aws/lambda/nodejs:22 as build

ARG lambda_dir
ENV lambda_dir ${lambda_dir}
ARG lambda_name
ENV lambda_name ${lambda_name}

COPY --from=sources /sources/ /tmp/build/
# Shared lambda packages, which are not in a parent folder of most lambdas
COPY lambdas/tsconfig.json /tmp/build/lambdas/tsconfig.json
COPY lambdas/packages /tmp/build/lambdas/packages
COPY lambdas/copy-ancestor-dirs.sh /tmp/build/lambdas/copy-ancestor-dirs.sh
COPY ${lambda_dir}/${lambda_name} /tmp/build/${lambda_dir}/${lambda_name}
COPY package.json package-lock.json tsconfig.json tsconfig.base.json ${lambda_dir}/${lambda_name}/tsconfig.build.json /tmp/build/

RUN dnf install -y rsync \
    && cd /tmp/build \
    && npm ci -w ${lambda_dir}/${lambda_name} $(sed 's/^/-w /' .ancestor-workspaces) --verbose \
    && npx tsc -b tsconfig.build.json --verbose \
    && cp ${lambda_dir}/${lambda_name}/dist/* -r /var/task/ \
    && sh lambdas/copy-ancestor-dirs.sh . ${lambda_dir} /var/task packages > /dev/null \
    && mkdir -p /var/task/lambdas \
    && cp -r lambdas/packages /var/task/lambdas/ \
    && cp -r node_modules /var/task/

# Ignore errors if node_modules is not present
RUN rsync -a ${lambda_dir}/${lambda_name}/node_modules/ /var/task/node_modules; exit 0

# The added layers from our build increase image size significantly. This flattens the image
# to reduce the size of the final image.
FROM public.ecr.aws/lambda/nodejs:22
COPY --from=build /var/task /var/task

# all of this is a little more fragile than I would like because we have to duplicate the parent repo
# at https://github.com/aws/aws-lambda-base-images/blob/nodejs16.x/Dockerfile.nodejs16.x
ENV LANG=en_US.UTF-8
ENV TZ=:/etc/localtime
ENV PATH=/var/lang/bin:/usr/local/bin:/usr/bin/:/bin:/opt/bin
ENV LD_LIBRARY_PATH=/var/lang/lib:/lib64:/usr/lib64:/var/runtime:/var/runtime/lib:/var/task:/var/task/lib:/opt/lib
ENV LAMBDA_TASK_ROOT=/var/task
ENV LAMBDA_RUNTIME_DIR=/var/runtime

WORKDIR /var/task

ENTRYPOINT ["/lambda-entrypoint.sh"]

# Set the CMD to your handler (could also be done as a parameter override outside of the Dockerfile)
CMD [ "index.handler" ]

FROM public.ecr.aws/lambda/nodejs:16 as build

ARG lambda_name
ENV lambda_name ${lambda_name}

# This is a bit complicated by the need for access to the packages.
# We must have the full repo context for our docker build so we can
# copy the hrm-lib package and labmdas folders so that the file: based
# dependency in package.json can be resolved
COPY packages /tmp/build/packages
COPY jobs /tmp/build/jobs
COPY package.json package-lock.json tsconfig.base.json tsconfig.build.jobs.json /tmp/build/

RUN cd /tmp/build \
    && npm ci -w jobs/${lambda_name} -w packages/* \
    && npx tsc -b tsconfig.build.jobs.json \
    && cp jobs/${lambda_name}/dist/*.js /var/task/ \
    && cp -r packages /var/task/ \
    && cp -r node_modules /var/task/ \
    && rm -rf /var/task/node_modules/typescript \
    && rm -rf /tmp/* \
    && rm -rf /root/.cache \
    && rm -rf /root/.npm \
    && rm -rf /usr/local/share/.cache \
    && rm -rf /usr/local/lib/node_modules

# The added layers from our build increase image size significantly. This flattens the image
# to reduce the size of the final image.
FROM scratch
COPY --from=build / /

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

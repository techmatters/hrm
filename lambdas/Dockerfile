FROM public.ecr.aws/lambda/nodejs:16 as build

ARG lambda_name
ENV lambda_name ${lambda_name}

# This is a bit complicated by the need for access to the hrm-lib package.
# We must have the full repo context for our docker build so we can
# copy the hrm-lib package and labmdas folders so that the file: based
# dependency in package.json can be resolved
COPY hrm-lib /tmp/build/hrm-lib
COPY lambdas /tmp/build/lambdas

RUN cd /tmp/build/lambdas \
    && npm install \
    && npm run build:lib \
    && npm run compile:lib \
    && npm run build:${lambda_name} \
    && npm run compile:${lambda_name} \
    && cd src/${lambda_name} \
    && cp *.js /var/task/ \
    && cp -r node_modules /var/task/ \
    && cd ../lib \
    # it is weird that this isn't a hard link after npm ci, but we get runtime errors without it.
    && cp -r hrm-ssm-cache /var/lib \
    && rm -rf /tmp/* \
    && rm -rf /root/.cache \
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

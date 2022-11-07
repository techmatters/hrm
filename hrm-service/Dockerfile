FROM node:16-alpine as build

# This is a bit complicated by the need for access to the package.
# We must have the full repo context for our docker build so we can
# copy the hrm-lib package and labmdas folders so that the file: based
# dependency in package.json can be resolved
COPY packages /tmp/build/packages
COPY hrm-service /tmp/build/hrm-service
COPY package.json package-lock.json tsconfig.base.json tsconfig.build.service.json /tmp/build/

RUN cd /tmp/build \
    && npm ci -w=hrm-service -w packages/* \
    && npx tsc -b tsconfig.build.service.json \
    && cp -r hrm-service/* /home/node/ \
    && cp -r packages /home/node/ \
    && cp -r node_modules /home/node/ \
    && rm -rf /tmp/* \
    && rm -rf /root/.cache \
    && rm -rf /usr/local/share/.cache

WORKDIR /home/node

# RUN npm test
USER node

CMD ["/usr/local/bin/npm", "start"]
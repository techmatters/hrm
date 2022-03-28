FROM node:14-alpine as builder

USER node
WORKDIR /home/node

COPY . /home/node

RUN npm install

# RUN npm test

CMD ["npm", "start"]
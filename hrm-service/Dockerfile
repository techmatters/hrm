FROM node:14-alpine as builder

WORKDIR /home/node

COPY . /home/node

RUN npm install
RUN npm run build

# RUN npm test
USER node

CMD ["npm", "start"]
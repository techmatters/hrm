/**
 * Copyright (C) 2021-2023 Technology Matters
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see https://www.gnu.org/licenses/.
 */

import { Mockttp, getLocal, generateCACertificate } from 'mockttp';
// @ts-ignore
import { createGlobalProxyAgent } from 'global-agent';

let mockServer: Mockttp;

export async function mockttpServer() {
  if (!mockServer) {
    //console.log('CREATING ENDPOINT SERVER');
    const https = await generateCACertificate();
    // Just wave through them self-signed certs... :-/
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    mockServer = getLocal({ https });
  }
  return mockServer;
}

export async function start(allowPassThrough = false): Promise<void> {
  const server = await mockttpServer();
  try {
    await server.stop();
  } catch (e) {
    // Ignore error
  }
  await server.start();
  // console.log('STARTED ENDPOINT SERVER');
  if (allowPassThrough) {
    await server.forUnmatchedRequest().thenPassThrough();
    // console.debug('ALLOWING PASS THROUGH');
  } else {
    await server.forUnmatchedRequest().thenCallback(req => {
      console.log('UNHANDLED MOCKTTP REQUEST', req);
      return {
        statusCode: 500,
        body: 'Not implemented',
      };
    });
    // console.debug('BLOCKING PASS THROUGH');
  }
  const global = createGlobalProxyAgent();
  // Filter local requests out from proxy to prevent loops.
  global.NO_PROXY = 'localhost*,127.0.*,local.home*,search-development-resources*';
  global.HTTP_PROXY = `http://localhost:${server.port}`;
}

export async function stop(): Promise<void> {
  const server = await mockttpServer();
  // console.debug('STOPPING ENDPOINT SERVER');
  await server.stop();
  // console.log('STOPPED ENDPOINT SERVER');
}

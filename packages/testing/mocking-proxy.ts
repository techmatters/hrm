import { Mockttp, getLocal, generateCACertificate } from 'mockttp';
// @ts-ignore
import { createGlobalProxyAgent } from 'global-agent';

let mockServer: Mockttp;

export async function mockttpServer() {
  if (!mockServer) {
    console.log('CREATING ENDPOINT SERVER');
    const https = await generateCACertificate();
    // Just wave through them self signed certs... :-/
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    mockServer = getLocal({ https });
  }
  return mockServer;
}

export async function start(): Promise<void> {
  const server = await mockttpServer();
  await server.start();
  console.log('STARTED ENDPOINT SERVER');
  await server.forAnyRequest().thenPassThrough();
  const global = createGlobalProxyAgent();
  // Filter local requests out from proxy to prevent loops.
  global.NO_PROXY = 'localhost*,127.0.*,local.home*';
  global.HTTP_PROXY = `http://localhost:${server.port}`;
}

export async function stop(): Promise<void> {
  const server = await mockttpServer();
  await server.stop();
}

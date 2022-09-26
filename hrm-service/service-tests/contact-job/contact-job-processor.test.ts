import supertest from 'supertest';
import timers from 'timers';

jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'warn').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

const wait = async (ms: number) => {
  const p = new Promise(resolve => setTimeout(resolve, ms));
  return p;
};

let server;
let createService;
let contactJobProcessor;
let contactJobComplete;
let contactJobPublish;

const startServer = () => {
  const service = createService({
    authTokenLookup: () => 'picernic basket',
  });

  service.listen();

  server = service;
};

const stopServer = async () => {
  if (server && server.close) await server.close();
  server = null;
  await wait(100);
};

beforeEach(() => {
  jest.isolateModules(() => {
    createService = require('../../src/app').createService;
    contactJobProcessor = require('../../src/contact-job/contact-job-processor');
    contactJobComplete = require('../../src/contact-job/contact-job-complete');
    contactJobPublish = require('../../src/contact-job/contact-job-publish');
  });
});

afterEach(async () => {
  await stopServer();
  // jest.resetModules();
  jest.clearAllMocks();
});

describe('processContactJobs', () => {
  test('intialized on server start', async () => {
    const processorSpy = jest.spyOn(contactJobProcessor, 'processContactJobs');

    const logSpy = jest.spyOn(console, 'log');

    startServer();

    expect(processorSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(
      `Started processing jobs every ${contactJobProcessor.getProcessingInterval()} milliseconds.`,
    );
  });

  test('calling processContactJobs twice does not spans another processor', async () => {
    const setIntervalSpy = jest.spyOn(timers, 'setInterval');
    const processorSpy = jest.spyOn(contactJobProcessor, 'processContactJobs');
    const warnSpy = jest.spyOn(console, 'warn');

    startServer();

    // await Promise.resolve();
    // await wait(2000);

    contactJobProcessor.processContactJobs();

    expect(processorSpy).toHaveBeenCalledTimes(2);

    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(`processContactJobs repeating task already running`);
  });

  test('swipes are as expected', async () => {
    jest.spyOn(contactJobProcessor, 'getProcessingInterval').mockImplementation(() => 10);
    const processorSpy = jest.spyOn(contactJobProcessor, 'processContactJobs');
    const completeSpy = jest.spyOn(contactJobComplete, 'processCompleteContactJobs');
    const publishSpy = jest.spyOn(contactJobPublish, 'publishPendingContactJobs');

    startServer();

    expect(processorSpy).toHaveBeenCalled();

    await wait(contactJobProcessor.getProcessingInterval());

    expect(completeSpy).toHaveBeenCalledTimes(1);
    expect(publishSpy).toHaveBeenCalledTimes(1);

    await wait(contactJobProcessor.getProcessingInterval());

    expect(completeSpy).toHaveBeenCalledTimes(2);
    expect(publishSpy).toHaveBeenCalledTimes(2);
  });

  test('error on swipe does not shuts down the server', async () => {
    jest.spyOn(contactJobProcessor, 'getProcessingInterval').mockImplementation(() => 10);
    const errorSpy = jest.spyOn(console, 'error');
    const processorSpy = jest.spyOn(contactJobProcessor, 'processContactJobs');
    const completeSpy = jest
      .spyOn(contactJobComplete, 'processCompleteContactJobs')
      .mockImplementationOnce(() => {
        throw new Error('Aaaw, snap!');
      });

    startServer();

    const request = supertest.agent(server);

    expect(processorSpy).toHaveBeenCalled();

    await wait(contactJobProcessor.getProcessingInterval());

    expect(completeSpy).toHaveBeenCalledTimes(1);

    expect(errorSpy).toHaveBeenCalledWith(
      'JOB PROCESSING SWEEP ABORTED DUE TO UNHANDLED ERROR',
      Error('Aaaw, snap!'),
    );

    completeSpy.mockClear();

    const response = await request.get('/');
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({ Message: 'HRM is up and running!' });

    await wait(contactJobProcessor.getProcessingInterval());

    // The another sweep is executed again in the future
    expect(completeSpy).toHaveBeenCalled();
  });

  test('error starting the processor wont start server', async () => {
    const processorSpy = jest
      .spyOn(contactJobProcessor, 'processContactJobs')
      .mockImplementationOnce(() => {
        throw new Error('Aaaw, snap!');
      });

    expect(() => startServer()).toThrow();
    expect(processorSpy).toHaveBeenCalled();
  });
});

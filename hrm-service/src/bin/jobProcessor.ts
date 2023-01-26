import { processContactJobs } from '../contact-job/contact-job-processor';
import { enableProcessContactJobsFlag } from '../featureFlags';

const stopSignals = [
  'SIGHUP',
  'SIGINT',
  'SIGQUIT',
  'SIGILL',
  'SIGTRAP',
  'SIGABRT',
  'SIGBUS',
  'SIGFPE',
  'SIGUSR1',
  'SIGSEGV',
  'SIGUSR2',
  'SIGTERM',
];

if (enableProcessContactJobsFlag) {
  const processorIntervalId = processContactJobs();

  const gracefulExit = async () => {
    //TODO: this should probably handle closing any running processes and open db connections
    clearInterval(processorIntervalId);
  };

  stopSignals.forEach(signal => {
    process.on(signal, async () => {
      console.log(`Caught ${signal}, stopping...`);
      await gracefulExit();
    });
  });
}

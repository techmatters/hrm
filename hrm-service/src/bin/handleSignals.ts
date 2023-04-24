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

export const handleSignals = async (callback: () => Promise<void>) => {
  stopSignals.forEach(signal => {
    process.on(signal, async () => {
      console.log(`Caught ${signal}, stopping...`);
      await callback();
    });
  });
};

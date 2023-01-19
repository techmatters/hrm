import express from 'express';

type ResourceServiceCreationOptions = {
  webServer: ReturnType<typeof express>;
  authTokenLookup: (accountSid: string) => string;
};

export const createService = ({ webServer }: ResourceServiceCreationOptions) => {
  webServer.use();
};

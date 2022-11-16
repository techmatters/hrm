export class ContactJobCompleteProcessorError extends Error {
  payload: any;

  constructor(message: string, payload: any) {
    super(message);
    this.name = 'ContactJobCompleteProcessorError';
    this.payload = payload;
  }
}

export class ContactJobPollerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContactJobPollerError';
  }
}

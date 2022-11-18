export class ContactJobProcessorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContactJobProcessorError';
  }
}

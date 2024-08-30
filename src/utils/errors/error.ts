export class SpecificError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'SpecificError';
    }
  }
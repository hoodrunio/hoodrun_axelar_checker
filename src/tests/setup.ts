import { config } from 'dotenv';

config({ path: '.env.example' });

// Mock console methods if needed
// global.console = {
//   ...console,
//   log: jest.fn(),
//   error: jest.fn(),
//   warn: jest.fn(),
// };

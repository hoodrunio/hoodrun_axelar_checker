import '@testing-library/jest-dom';

// Global test timeout
jest.setTimeout(30000);

// Console error ve warning'leri gizle
console.error = jest.fn();
console.warn = jest.fn(); 
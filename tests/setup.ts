import '@testing-library/jest-dom';

// Mock environment variables for tests
Object.assign(process.env, {
  DATABASE_URL: 'postgresql://test:test@localhost:5433/backupdb_test',
  NEXTAUTH_SECRET: 'test-secret',
  NEXTAUTH_URL: 'http://localhost:3000',
  NODE_ENV: 'test',
});

// Global test utilities
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
};

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      pathname: '/',
      query: {},
      asPath: '/',
    };
  },
  useSearchParams() {
    return new URLSearchParams();
  },
  usePathname() {
    return '/';
  },
}));

// Reset mocks after each test
afterEach(() => {
  jest.clearAllMocks();
});

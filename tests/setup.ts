import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

// Polyfill for Web APIs required by Next.js server components
Object.assign(global, { TextDecoder, TextEncoder });

// Mock Request and Response for Next.js server components
(global as any).Request = class MockRequest {
  url: string;
  method: string;
  headers: Map<string, string>;

  constructor(input: any, init?: any) {
    this.url = input;
    this.method = init?.method || 'GET';
    this.headers = new Map(Object.entries(init?.headers || {}));
  }
};

(global as any).Response = class MockResponse {
  body: any;
  status: number;
  headers: Map<string, string>;

  constructor(body?: any, init?: any) {
    this.body = body;
    this.status = init?.status || 200;
    this.headers = new Map(Object.entries(init?.headers || {}));
  }

  static json(data: any, init?: any) {
    return new (global as any).Response(JSON.stringify(data), {
      ...init,
      headers: {
        ...init?.headers,
        'content-type': 'application/json',
      },
    });
  }

  async json() {
    return typeof this.body === 'string' ? JSON.parse(this.body) : this.body;
  }
};

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

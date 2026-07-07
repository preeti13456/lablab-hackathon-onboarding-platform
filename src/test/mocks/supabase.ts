import { vi } from "vitest";

export const mockSupabase = {
  auth: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    })),
    signInWithOtp: vi.fn(),
    signInWithPassword: vi.fn(),
    signInWithOAuth: vi.fn(),
    signOut: vi.fn(),
  },
  from: vi.fn(() => mockQueryBuilder),
  functions: {
    invoke: vi.fn(),
  },
};

const mockQueryBuilder = {
  select: vi.fn(() => mockQueryBuilder),
  insert: vi.fn(() => mockQueryBuilder),
  update: vi.fn(() => mockQueryBuilder),
  delete: vi.fn(() => mockQueryBuilder),
  eq: vi.fn(() => mockQueryBuilder),
  neq: vi.fn(() => mockQueryBuilder),
  in: vi.fn(() => mockQueryBuilder),
  order: vi.fn(() => mockQueryBuilder),
  single: vi.fn(() => mockQueryBuilder),
  maybeSingle: vi.fn(() => mockQueryBuilder),
  then: vi.fn(),
};

// Make `.then()` chainable as a real promise
mockQueryBuilder.then.mockImplementation((onfulfilled?: unknown) => {
  return Promise.resolve(
    typeof onfulfilled === "function" ? onfulfilled({ data: null, error: null }) : { data: null, error: null }
  );
});

// Setup default mock implementations
mockSupabase.auth.getSession.mockResolvedValue({
  data: { session: null },
  error: null,
});

mockSupabase.auth.onAuthStateChange.mockReturnValue({
  data: { subscription: { unsubscribe: vi.fn() } },
});

export function createMockSupabase() {
  // Reset all mocks
  vi.clearAllMocks();

  // Re-apply defaults
  mockSupabase.auth.getSession.mockResolvedValue({
    data: { session: null },
    error: null,
  });

  mockSupabase.auth.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });

  return mockSupabase;
}
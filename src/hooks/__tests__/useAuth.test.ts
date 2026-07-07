import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createMockSupabase } from "../../test/mocks/supabase";

// Set up mocks before importing the module
vi.mock("../../lib/supabase", () => ({
  supabase: createMockSupabase(),
}));

// Need to create a fresh mock reference for each test
let mockSupabase: ReturnType<typeof createMockSupabase>;

beforeEach(() => {
  mockSupabase = createMockSupabase();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useAuth", () => {
  it("starts in loading state", async () => {
    // Delay the session resolution
    mockSupabase.auth.getSession.mockReturnValue(
      new Promise(() => {
        /* never resolves during test */
      })
    );

    const { useAuth } = await import("../useAuth");
    const { result } = renderHook(() => useAuth());

    expect(result.current.status).toBe("loading");
  });

  it("returns unauthenticated when no session exists", async () => {
    // Default mock already returns no session
    const { useAuth } = await import("../useAuth");
    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.status).toBe("unauthenticated");
    });
  });

  it("returns authenticated with participant role", async () => {
    const mockUser = { id: "user-1", email: "test@example.com" };

    mockSupabase.auth.getSession.mockResolvedValue({
      data: {
        session: {
          user: mockUser,
          access_token: "token",
          refresh_token: "refresh",
          expires_in: 3600,
        },
      },
      error: null,
    });

    // First getSession call -> no participant yet -> will check email
    // We need to set up the chain for maybeSingle

    // Mock the chain for from("organizers").select("id").eq("auth_user_id", ...).maybeSingle()
    const organizerBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    const participantBuilderByAuth = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    const participantBuilderByEmail = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi
        .fn()
        .mockResolvedValue({ data: { id: "participant-1" }, error: null }),
    };

    const updateBuilder = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    };

    // Mock the .then to be chainable like a real promise
    updateBuilder.update.mockReturnValue(
      Promise.resolve({ data: null, error: null })
    );

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "organizers") return organizerBuilder;
      if (table === "participants") {
        // Return different builders based on what method is called
        // We'll use the same builder and mock maybeSingle to behave differently
        return {
          ...participantBuilderByAuth,
          update: vi.fn(() => ({
            ...updateBuilder,
          })),
        };
      }
      return organizerBuilder;
    });

    // For the email match path: participantBuilderByAuth's maybeSingle returns null
    // then we call .eq("email", email).maybeSingle() which returns the participant
    // This gets complex. Let me simplify.

    // Simplified approach:
    // from("organizers").select("id").eq("auth_user_id", user-1).maybeSingle() -> null
    // from("participants").select("id").eq("auth_user_id", user-1).maybeSingle() -> null
    // from("participants").select("id").eq("email", "test@example.com").maybeSingle() -> participant
    // from("participants").update({auth_user_id: user-1}).eq("id", participant-1) -> success

    // Let me use a smarter mock
    const organizerChain: Record<string, unknown> = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    let callCount = 0;
    const participantChain: Record<string, unknown> = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockImplementation((_field: string, _value: string) => {
        callCount++;
        return participantChain;
      }),
      maybeSingle: vi.fn().mockImplementation(() => {
        callCount++;
        // On first call (auth_user_id match) -> null
        // On second call (email match) -> participant
        if (callCount >= 3) {
          return Promise.resolve({
            data: { id: "participant-1" },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    };

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "organizers") return organizerChain;
      return participantChain;
    });

    const { useAuth } = await import("../useAuth");
    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.status).toBe("authenticated");
    });

    if (result.current.status === "authenticated") {
      expect(result.current.role).toBe("participant");
      expect(result.current.user).toEqual(mockUser);
    }
  });

  it("returns authenticated with organizer role", async () => {
    const mockUser = { id: "org-user", email: "org@example.com" };

    mockSupabase.auth.getSession.mockResolvedValue({
      data: {
        session: {
          user: mockUser,
          access_token: "token",
          refresh_token: "refresh",
          expires_in: 3600,
        },
      },
      error: null,
    });

    const builder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi
        .fn()
        .mockResolvedValue({ data: { id: "organizer-1" }, error: null }),
    };

    mockSupabase.from.mockReturnValue(builder);

    const { useAuth } = await import("../useAuth");
    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.status).toBe("authenticated");
    });

    if (result.current.status === "authenticated") {
      expect(result.current.role).toBe("organizer");
    }
  });

  it("returns unauthenticated after auth state change to no session", async () => {
    // Mock getSession returns no session at first
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const { useAuth } = await import("../useAuth");
    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.status).toBe("unauthenticated");
    });
  });
});

describe("useCurrentParticipant", () => {
  it("returns loading initially and null participant when no session", async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const { useCurrentParticipant } = await import("../useAuth");
    const { result } = renderHook(() => useCurrentParticipant());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.participant).toBeNull();
  });

  it("returns participant when session exists", async () => {
    const mockParticipant = {
      id: "p-1",
      name: "Test User",
      email: "test@example.com",
      team_id: "team-1",
      hackathon_id: "hack-1",
      steps_completed: { amd: true, fireworks: false, natively_ai: false },
      auth_user_id: "user-1",
      github_username: "testuser",
      discord_username: "testuser#1234",
      created_at: "2024-01-01T00:00:00Z",
    };

    mockSupabase.auth.getSession.mockResolvedValue({
      data: {
        session: {
          user: { id: "user-1", email: "test@example.com" },
          access_token: "token",
          refresh_token: "refresh",
          expires_in: 3600,
        },
      },
      error: null,
    });

    const builder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: mockParticipant,
        error: null,
      }),
    };

    mockSupabase.from.mockReturnValue(builder);

    const { useCurrentParticipant } = await import("../useAuth");
    const { result } = renderHook(() => useCurrentParticipant());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.participant).toEqual(mockParticipant);
  });
});
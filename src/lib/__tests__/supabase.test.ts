import { describe, it, expect, vi, beforeEach } from "vitest";

describe("supabase client", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("throws if VITE_SUPABASE_URL is missing", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-key");

    await expect(async () => {
      await import("../supabase");
    }).rejects.toThrow(
      "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables."
    );
  });

  it("throws if VITE_SUPABASE_ANON_KEY is missing", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");

    await expect(async () => {
      await import("../supabase");
    }).rejects.toThrow(
      "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables."
    );
  });

  it("creates a supabase client with correct config when env vars are set", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");

    const { supabase } = await import("../supabase");

    expect(supabase).toBeDefined();
  });
});
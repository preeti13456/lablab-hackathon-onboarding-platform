import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { APP_NAME, APP_TAGLINE } from "../../lib/config";

// Mock supabase
const mockSignInWithOtp = vi.fn();
const mockSignInWithPassword = vi.fn();
const mockSignInWithOAuth = vi.fn();

vi.mock("../../lib/supabase", () => ({
  supabase: {
    auth: {
      signInWithOtp: (...args: unknown[]) => mockSignInWithOtp(...args),
      signInWithPassword: (...args: unknown[]) =>
        mockSignInWithPassword(...args),
      signInWithOAuth: (...args: unknown[]) => mockSignInWithOAuth(...args),
    },
  },
}));

// Need to mock config too since imports are cached
vi.mock("../../lib/config", () => ({
  APP_NAME: "LabLab Onboarding",
  APP_TAGLINE: "Get ready to build",
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Auth", () => {
  it("renders the app name and tagline", async () => {
    const Auth = (await import("../Auth")).default;
    render(<Auth />);

    expect(screen.getByText(APP_NAME)).toBeInTheDocument();
    expect(screen.getByText(APP_TAGLINE)).toBeInTheDocument();
  });

  it("shows magic link form by default", async () => {
    const Auth = (await import("../Auth")).default;
    render(<Auth />);

    expect(
      screen.getByPlaceholderText("you@example.com")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /send magic link/i })
    ).toBeInTheDocument();
  });

  it("switches to password mode when clicking Password tab", async () => {
    const user = userEvent.setup();
    const Auth = (await import("../Auth")).default;
    render(<Auth />);

    const passwordTab = screen.getByRole("button", { name: /password/i });
    await user.click(passwordTab);

    expect(
      screen.getByPlaceholderText("Password")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /sign in/i })
    ).toBeInTheDocument();
  });

  it("calls signInWithOtp on magic link submit", async () => {
    const user = userEvent.setup();
    mockSignInWithOtp.mockResolvedValue({ error: null });

    const Auth = (await import("../Auth")).default;
    render(<Auth />);

    const emailInput = screen.getByPlaceholderText("you@example.com");
    const submitBtn = screen.getByRole("button", {
      name: /send magic link/i,
    });

    await user.type(emailInput, "test@example.com");
    await user.click(submitBtn);

    expect(mockSignInWithOtp).toHaveBeenCalledWith({
      email: "test@example.com",
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
  });

  it("shows success message after magic link sent", async () => {
    const user = userEvent.setup();
    mockSignInWithOtp.mockResolvedValue({ error: null });

    const Auth = (await import("../Auth")).default;
    render(<Auth />);

    const emailInput = screen.getByPlaceholderText("you@example.com");
    const submitBtn = screen.getByRole("button", {
      name: /send magic link/i,
    });

    await user.type(emailInput, "test@example.com");
    await user.click(submitBtn);

    expect(
      screen.getByText(/magic link sent/i)
    ).toBeInTheDocument();
  });

  it("shows error message when magic link fails", async () => {
    const user = userEvent.setup();
    mockSignInWithOtp.mockResolvedValue({
      error: { message: "Rate limit exceeded" },
    });

    const Auth = (await import("../Auth")).default;
    render(<Auth />);

    const emailInput = screen.getByPlaceholderText("you@example.com");
    const submitBtn = screen.getByRole("button", {
      name: /send magic link/i,
    });

    await user.type(emailInput, "test@example.com");
    await user.click(submitBtn);

    expect(screen.getByText("Rate limit exceeded")).toBeInTheDocument();
  });

  it("calls signInWithPassword on password sign in", async () => {
    const user = userEvent.setup();
    mockSignInWithPassword.mockResolvedValue({ error: null });
    mockSignInWithOtp.mockResolvedValue({ error: null });

    const Auth = (await import("../Auth")).default;
    render(<Auth />);

    // Switch to password mode
    const passwordTab = screen.getByRole("button", { name: /password/i });
    await user.click(passwordTab);

    const emailInput = screen.getByPlaceholderText("you@example.com");
    const passwordInput = screen.getByPlaceholderText("Password");

    await user.type(emailInput, "test@example.com");
    await user.type(passwordInput, "mypassword");

    const signInBtn = screen.getByRole("button", { name: /sign in/i });
    await user.click(signInBtn);

    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: "test@example.com",
      password: "mypassword",
    });
  });

  it("shows error on invalid password credentials", async () => {
    const user = userEvent.setup();
    mockSignInWithPassword.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });

    const Auth = (await import("../Auth")).default;
    render(<Auth />);

    // Switch to password mode
    const passwordTab = screen.getByRole("button", { name: /password/i });
    await user.click(passwordTab);

    await user.type(
      screen.getByPlaceholderText("you@example.com"),
      "test@example.com"
    );
    await user.type(screen.getByPlaceholderText("Password"), "wrongpass");

    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(
      screen.getByText(/wrong email or password/i)
    ).toBeInTheDocument();
  });

  it("disables submit button when email is empty", async () => {
    const Auth = (await import("../Auth")).default;
    render(<Auth />);

    const submitBtn = screen.getByRole("button", {
      name: /send magic link/i,
    });

    expect(submitBtn).toBeDisabled();
  });

  it("calls signInWithOAuth for GitHub", async () => {
    const user = userEvent.setup();
    mockSignInWithOAuth.mockResolvedValue({ error: null });

    const Auth = (await import("../Auth")).default;
    render(<Auth />);

    const githubBtn = screen.getByRole("button", { name: /github/i });
    await user.click(githubBtn);

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: "github",
      options: {
        redirectTo: window.location.origin,
      },
    });
  });

  it("shows error message when GitHub OAuth fails", async () => {
    const user = userEvent.setup();
    mockSignInWithOAuth.mockResolvedValue({
      error: { message: "OAuth provider error" },
    });

    const Auth = (await import("../Auth")).default;
    render(<Auth />);

    const githubBtn = screen.getByRole("button", { name: /github/i });
    await user.click(githubBtn);

    expect(
      screen.getByText("OAuth provider error")
    ).toBeInTheDocument();
  });
});
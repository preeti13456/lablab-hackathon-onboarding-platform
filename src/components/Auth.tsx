import { useState } from "react";
import { supabase } from "../lib/supabase";
import { APP_NAME, APP_TAGLINE } from "../lib/config";
import { Mail, Loader2 } from "lucide-react";
import { SiGithub } from "react-icons/si";

type AuthMode = "magic" | "password";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<AuthMode>("magic");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}`,
      },
    });

    if (error) {
      setMessage({ type: "error", text: error.message });
    } else {
      setMessage({
        type: "success",
        text: "Magic link sent! Check your email inbox.",
      });
    }
    setLoading(false);
  }

  async function handlePasswordSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setMessage({
        type: "error",
        text:
          error.message === "Invalid login credentials"
            ? "Wrong email or password. Try again."
            : error.message,
      });
    }
    setLoading(false);
  }

  async function handleGithubOAuth() {
    setLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: `${window.location.origin}`,
      },
    });

    if (error) {
      setMessage({ type: "error", text: error.message });
      setLoading(false);
    }
    // OAuth redirects away, no need to set loading false
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {/* Logo / Brand */}
      <div className="mb-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
          <span className="text-accent font-heading text-2xl">LL</span>
        </div>
        <h1 className="font-heading text-3xl text-foreground tracking-wider uppercase">
          {APP_NAME}
        </h1>
        <p className="text-foreground/60 text-sm mt-2 font-sans">{APP_TAGLINE}</p>
      </div>

      {/* Auth Card */}
      <div className="w-full max-w-sm">
        <div className="bg-muted border border-border rounded-2xl p-6">
          {message && (
            <div
              role="alert"
              className={`mb-4 px-4 py-3 rounded-xl text-sm ${
                message.type === "success"
                  ? "bg-accent/10 text-accent border border-accent/20"
                  : "bg-destructive/10 text-destructive border border-destructive/20"
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Tabs: Magic Link / Password */}
          <div className="flex mb-6 bg-background rounded-xl p-1 border border-border">
            <button
              type="button"
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-150 ${
                mode === "magic"
                  ? "bg-accent text-black shadow-sm"
                  : "text-foreground/60 hover:text-foreground"
              }`}
              onClick={() => setMode("magic")}
              aria-pressed={mode === "magic"}
            >
              Magic Link
            </button>
            <button
              type="button"
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-150 ${
                mode === "password"
                  ? "bg-accent text-black shadow-sm"
                  : "text-foreground/60 hover:text-foreground"
              }`}
              onClick={() => setMode("password")}
              aria-pressed={mode === "password"}
            >
              Password
            </button>
          </div>

          {/* Email Form */}
          {mode === "magic" ? (
            <form onSubmit={handleMagicLink} className="space-y-4">
              <div>
                <label htmlFor="magic-email" className="sr-only">
                  Email address
                </label>
                <input
                  id="magic-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground placeholder-foreground/40 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/50 transition-all duration-150"
                  autoComplete="email"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full py-3 bg-accent text-black font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Mail className="w-4 h-4" aria-hidden="true" />
                )}
                Send Magic Link
              </button>
            </form>
          ) : (
            <form onSubmit={handlePasswordSignIn} className="space-y-4">
              <div>
                <label htmlFor="password-email" className="sr-only">
                  Email address
                </label>
                <input
                  id="password-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground placeholder-foreground/40 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/50 transition-all duration-150"
                  autoComplete="email"
                />
              </div>
              <div>
                <label htmlFor="password" className="sr-only">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground placeholder-foreground/40 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/50 transition-all duration-150"
                  autoComplete="current-password"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !email.trim() || !password}
                className="w-full py-3 bg-accent text-black font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : null}
                Sign In
              </button>
            </form>
          )}

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 text-xs text-foreground/40 bg-muted">
                or continue with
              </span>
            </div>
          </div>

          {/* GitHub OAuth */}
          <button
            type="button"
            onClick={handleGithubOAuth}
            disabled={loading}
            className="w-full py-3 bg-background border border-border text-foreground rounded-xl hover:bg-border/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 active:scale-[0.98] cursor-pointer flex items-center justify-center gap-3"
          >
            <SiGithub className="w-5 h-5" aria-hidden="true" />
            <span className="font-medium">GitHub</span>
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-foreground/40">
          By signing in, you agree to participate in the hackathon.
          <br />
          Contact your organizer if you don't have access.
        </p>
      </div>
    </div>
  );
}
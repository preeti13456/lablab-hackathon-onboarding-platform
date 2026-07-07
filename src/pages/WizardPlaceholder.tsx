import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useCurrentParticipant } from "../hooks/useAuth";
import type { Tables } from "../lib/database.types";
import {
  Loader2,
  Check,
  ExternalLink,
  AlertCircle,
  Github,
  MessageSquare,
  Sparkles,
  ChevronDown,
  Shield,
  KeyRound,
  User,
} from "lucide-react";
import { SiDiscord } from "react-icons/si";

/* ── Types ─────────────────────────────────────────── */

type StepsCompleted = {
  amd: boolean;
  fireworks: boolean;
  natively_ai: boolean;
};

interface StepDef {
  key: keyof StepsCompleted;
  label: string;
  description: string;
  href?: string;
  hrefLabel?: string;
}

const STEPS: StepDef[] = [
  {
    key: "amd",
    label: "AMD Cloud Account",
    description:
      "Create an AMD Cloud account to access accelerated compute for your hackathon project.",
    href: "https://amdcloud.amd.com/",
    hrefLabel: "Sign up for AMD Cloud",
  },
  {
    key: "fireworks",
    label: "Fireworks API Key",
    description:
      "Generate a Fireworks AI API key so your app can run large language models.",
    href: "https://fireworks.ai/",
    hrefLabel: "Get your API key",
  },
  {
    key: "natively_ai",
    label: "Natively AI Account",
    description:
      "Sign up for a Natively AI account to deploy and manage your AI pipelines.",
    href: "https://natively.ai/",
    hrefLabel: "Create Natively AI account",
  },
];

/* ── Helpers ────────────────────────────────────────── */

function getStepsCompleted(
  raw: unknown
): StepsCompleted {
  if (typeof raw === "object" && raw !== null) {
    const r = raw as Record<string, unknown>;
    return {
      amd: Boolean(r.amd),
      fireworks: Boolean(r.fireworks),
      natively_ai: Boolean(r.natively_ai),
    };
  }
  return { amd: false, fireworks: false, natively_ai: false };
}

/* ── Step Card ─────────────────────────────────────── */

function StepCard({
  step,
  index,
  isComplete,
  isActive,
  children,
  onToggle,
}: {
  step: StepDef;
  index: number;
  isComplete: boolean;
  isActive: boolean;
  children: React.ReactNode;
  onToggle: () => void;
}) {
  const isLocked = !isComplete && !isActive;

  return (
    <div
      className={`rounded-2xl border transition-all duration-200 ${
        isActive
          ? "border-accent/40 bg-muted/80 shadow-[0_0_20px_rgba(34,197,94,0.06)]"
          : isComplete
            ? "border-border bg-muted/40"
            : "border-border/60 bg-muted/20 opacity-50"
      }`}
    >
      {/* Header (always clickable) */}
      <button
        type="button"
        onClick={isLocked ? undefined : onToggle}
        disabled={isLocked}
        className="w-full flex items-center gap-4 p-5 text-left cursor-pointer transition-colors duration-150"
      >
        {/* Status icon */}
        <div
          className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center shrink-0 transition-all duration-200 ${
            isComplete
              ? "bg-accent/15 border-accent text-accent"
              : isActive
                ? "bg-background border-accent/50 text-accent"
                : "bg-background border-border text-foreground/40"
          }`}
        >
          {isComplete ? (
            <Check className="w-5 h-5" aria-hidden="true" />
          ) : isActive ? (
            <span className="font-heading text-sm">{index + 1}</span>
          ) : (
            <span className="font-heading text-sm">{index + 1}</span>
          )}
        </div>

        {/* Label */}
        <div className="flex-1 min-w-0">
          <h3
            className={`font-medium transition-colors duration-200 ${
              isComplete
                ? "text-accent"
                : isActive
                  ? "text-foreground"
                  : "text-foreground/50"
            }`}
          >
            {step.label}
            {!isActive && isComplete && (
              <span className="ml-2 text-xs text-accent/70 font-normal">
                Complete
              </span>
            )}
          </h3>
        </div>

        {/* Chevron */}
        <ChevronDown
          className={`w-4 h-4 text-foreground/40 transition-transform duration-200 ${
            isActive ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {/* Expanded content */}
      <div
        className={`overflow-hidden transition-all duration-300 ${
          isActive ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-5 pb-5 pt-0 border-t border-border/40">
          {children}
        </div>
      </div>
    </div>
  );
}

/* ── Main Wizard ───────────────────────────────────── */

export default function WizardPlaceholder() {
  const { participant, loading: participantLoading } = useCurrentParticipant();
  const [steps, setSteps] = useState<StepsCompleted>({
    amd: false,
    fireworks: false,
    natively_ai: false,
  });
  const [githubUsername, setGithubUsername] = useState("");
  const [discordUsername, setDiscordUsername] = useState("");
  const [team, setTeam] = useState<Tables<"teams"> | null>(null);
  const [teammates, setTeammates] = useState<Tables<"participants">[]>([]);
  const [hackathonName, setHackathonName] = useState("");
  const [saving, setSaving] = useState(false);
  const [fireworksKey, setFireworksKey] = useState("");
  const [fireworksValidating, setFireworksValidating] = useState(false);
  const [fireworksError, setFireworksError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [completedMessage, setCompletedMessage] = useState(false);

  // Determine which step is active (first incomplete of the first 3)
  const firstIncomplete = STEPS.findIndex((s) => !steps[s.key]);
  const currentStepIndex =
    firstIncomplete === -1 ? STEPS.length : firstIncomplete;

  const allThreeDone =
    steps.amd && steps.fireworks && steps.natively_ai;
  const githubDiscordDone = githubUsername.trim().length > 0 && discordUsername.trim().length > 0;

  // Load participant data
  useEffect(() => {
    if (!participant) return;

    const raw = participant.steps_completed;
    const parsed = getStepsCompleted(raw);
    setSteps(parsed);

    if (participant.github_username) setGithubUsername(participant.github_username);
    if (participant.discord_username) setDiscordUsername(participant.discord_username);

    // Fetch team + hackathon
    if (participant.team_id) {
      supabase
        .from("teams")
        .select("*")
        .eq("id", participant.team_id)
        .single()
        .then(({ data }) => {
          if (data) setTeam(data);
        });
    }

    if (participant.hackathon_id) {
      supabase
        .from("hackathons")
        .select("name")
        .eq("id", participant.hackathon_id)
        .single()
        .then(({ data }) => {
          if (data) setHackathonName(data.name);
        });
    }
  }, [participant]);

  // Fetch teammates
  useEffect(() => {
    if (!participant?.team_id) return;
    supabase
      .from("participants")
      .select("*")
      .eq("team_id", participant.team_id)
      .neq("id", participant.id)
      .then(({ data }) => {
        if (data) setTeammates(data);
      });
  }, [participant]);

  // Show completed message after all steps done
  useEffect(() => {
    if (allThreeDone && githubDiscordDone) {
      setCompletedMessage(true);
    }
  }, [allThreeDone, githubDiscordDone]);

  /* ── Actions ──────────────────────────────────────── */

  const markStep = useCallback(
    async (key: keyof StepsCompleted) => {
      if (!participant) return;
      setSaving(true);
      setSaveError("");

      const updated = { ...steps, [key]: true };

      const { error } = await supabase
        .from("participants")
        .update({ steps_completed: updated })
        .eq("id", participant.id);

      if (error) {
        setSaveError("Failed to save progress. Please try again.");
        setSaving(false);
        return;
      }

      // Log to audit
      await supabase.from("audit_logs").insert({
        hackathon_id: participant.hackathon_id,
        actor_id: participant.id,
        actor_role: "participant",
        action: "step_completed",
        metadata: { step: key },
      });

      setSteps(updated);
      setSaving(false);

      // Auto-advance to next step
      const nextIdx = STEPS.findIndex((s) => !updated[s.key]);
      setExpandedStep(nextIdx === -1 ? null : nextIdx);
    },
    [participant, steps]
  );

  const validateFireworks = useCallback(async () => {
    if (!fireworksKey.trim() || !participant) return;
    setFireworksValidating(true);
    setFireworksError("");

    const { data, error } = await supabase.functions.invoke("verify-fireworks", {
      body: { api_key: fireworksKey.trim() },
    });

    if (error) {
      setFireworksError("Could not reach the verification service. Try again.");
      setFireworksValidating(false);
      return;
    }

    if (data?.valid) {
      await markStep("fireworks");
      setFireworksValidating(false);
    } else {
      setFireworksError(data?.message ?? "Invalid API key — please check and try again.");
      setFireworksValidating(false);
    }
  }, [fireworksKey, participant, markStep]);

  const saveGitHubDiscord = useCallback(async () => {
    if (!participant) return;
    setSaving(true);
    setSaveError("");

    const { error } = await supabase
      .from("participants")
      .update({
        github_username: githubUsername.trim(),
        discord_username: discordUsername.trim(),
      })
      .eq("id", participant.id);

    if (error) {
      setSaveError("Failed to save usernames. Try again.");
      setSaving(false);
      return;
    }

    // Also log
    await supabase.from("audit_logs").insert({
      hackathon_id: participant.hackathon_id,
      actor_id: participant.id,
      actor_role: "participant",
      action: "step_completed",
      metadata: { step: "github_discord" },
    });

    setSaving(false);
  }, [participant, githubUsername, discordUsername]);

  /* ── Loading ──────────────────────────────────────── */

  if (participantLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-6 h-6 text-accent animate-spin" aria-hidden="true" />
      </div>
    );
  }

  if (!participant) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <h1 className="font-heading text-xl text-foreground tracking-wider uppercase">
          No Hackathon Found
        </h1>
        <p className="text-foreground/60 mt-3 max-w-md mx-auto">
          Your email isn&apos;t registered in any active hackathon. Contact
          your organizer to get set up.
        </p>
      </div>
    );
  }

  /* ── All done state ─────────────────────────────── */

  if (completedMessage) {
    return (
      <div className="max-w-2xl mx-auto">
        {/* Welcome */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent/15 border border-accent/30 mb-4">
            <Sparkles className="w-8 h-8 text-accent" aria-hidden="true" />
          </div>
          <h1 className="font-heading text-2xl text-foreground tracking-wider uppercase">
            You&apos;re All Set!
          </h1>
          <p className="text-foreground/60 mt-2 max-w-md mx-auto">
            All onboarding steps are complete. Your organizer will create your
            team&apos;s repo and Discord channel once everyone is ready.
          </p>
        </div>

        {/* Team card */}
        <div className="bg-muted border border-border rounded-2xl p-6 mb-8">
          <h2 className="font-heading text-xs tracking-wider text-accent uppercase mb-3">
            Your Team
          </h2>
          <p className="text-lg font-medium">{team?.name ?? participant.name}</p>
          <p className="text-foreground/40 text-sm font-mono mt-1">
            {participant.email}
          </p>

          {teammates.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border/40 space-y-2">
              <p className="text-xs text-foreground/40 uppercase tracking-wider">
                Teammates
              </p>
              {teammates.map((t) => (
                <div key={t.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center">
                    <User className="w-4 h-4 text-foreground/40" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-sm text-foreground/80">{t.name}</p>
                    <p className="text-xs text-foreground/40 font-mono">
                      {t.email}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {team?.github_repo_url && (
            <a
              href={team.github_repo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 text-sm text-secondary hover:text-secondary/80 transition-colors duration-150 cursor-pointer"
            >
              <Github className="w-4 h-4" aria-hidden="true" />
              View your team repo
              <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </a>
          )}
        </div>
      </div>
    );
  }

  /* ── Main Wizard ─────────────────────────────────── */

  return (
    <div className="max-w-2xl mx-auto">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="font-heading text-2xl text-foreground tracking-wider uppercase">
          Welcome, {participant.name}
        </h1>
        <p className="text-foreground/60 mt-1">
          {hackathonName && (
            <span className="text-accent">{hackathonName}</span>
          )}{" "}
          — Complete each step below to set up your accounts.
        </p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => {
          const done = steps[s.key];
          const isCurrent = i === currentStepIndex;
          return (
            <div key={s.key} className="flex-1 flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  done
                    ? "bg-accent shadow-[0_0_6px_rgba(34,197,94,0.5)]"
                    : isCurrent
                      ? "bg-accent/60"
                      : "bg-muted border border-border"
                }`}
                aria-label={
                  done
                    ? `${s.label} complete`
                    : isCurrent
                      ? `Current step: ${s.label}`
                      : s.label
                }
              />
              {i < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-px transition-colors duration-300 ${
                    done ? "bg-accent/40" : "bg-border"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Team card */}
      <div className="bg-muted border border-border rounded-2xl p-5 mb-8">
        <h2 className="font-heading text-xs tracking-wider text-accent uppercase mb-2">
          Your Team
        </h2>
        <p className="text-lg font-medium">{team?.name ?? participant.name}</p>
        <p className="text-foreground/40 text-sm font-mono">{participant.email}</p>
        {teammates.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {teammates.map((t) => (
              <span
                key={t.id}
                className="text-xs bg-background border border-border/60 rounded-full px-3 py-1 text-foreground/60"
              >
                {t.name}
              </span>
            ))}
          </div>
        )}
        {team?.github_repo_url && (
          <a
            href={team.github_repo_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-xs text-secondary hover:text-secondary/80 transition-colors duration-150 cursor-pointer"
          >
            <Github className="w-3.5 h-3.5" aria-hidden="true" />
            Team repo
            <ExternalLink className="w-3 h-3" aria-hidden="true" />
          </a>
        )}
      </div>

      {/* Error banner */}
      {saveError && (
        <div className="flex items-center gap-3 bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 mb-6 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          {saveError}
        </div>
      )}

      {/* Steps */}
      <div className="space-y-3">
        {STEPS.map((step, i) => {
          const isComplete = steps[step.key];
          const isActive =
            expandedStep === i || (!isComplete && expandedStep === null && currentStepIndex === i);

          return (
            <StepCard
              key={step.key}
              step={step}
              index={i}
              isComplete={isComplete}
              isActive={isActive}
              onToggle={() =>
                setExpandedStep(expandedStep === i ? null : i)
              }
            >
              <div className="space-y-4 mt-3">
                <p className="text-sm text-foreground/70 leading-relaxed">
                  {step.description}
                </p>

                {/* Step 1: AMD */}
                {step.key === "amd" && !isComplete && (
                  <div className="space-y-3">
                    <a
                      href={step.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-secondary hover:text-secondary/80 transition-colors duration-150 cursor-pointer"
                    >
                      <ExternalLink className="w-4 h-4" aria-hidden="true" />
                      {step.hrefLabel}
                    </a>
                    <button
                      type="button"
                      onClick={() => markStep("amd")}
                      disabled={saving}
                      className="w-full flex items-center justify-center gap-2 bg-accent text-white font-medium rounded-xl px-5 py-3 hover:bg-accent/90 active:scale-[0.97] transition-all duration-150 disabled:opacity-50 cursor-pointer"
                    >
                      {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Check className="w-4 h-4" aria-hidden="true" />
                      )}
                      I&apos;ve signed up — Mark Complete
                    </button>
                  </div>
                )}

                {/* Step 2: Fireworks */}
                {step.key === "fireworks" && !isComplete && (
                  <div className="space-y-3">
                    <a
                      href={step.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-secondary hover:text-secondary/80 transition-colors duration-150 cursor-pointer"
                    >
                      <ExternalLink className="w-4 h-4" aria-hidden="true" />
                      {step.hrefLabel}
                    </a>
                    <div className="space-y-2">
                      <label
                        htmlFor="fireworks-key"
                        className="text-xs text-foreground/50 uppercase tracking-wider"
                      >
                        Fireworks API Key
                      </label>
                      <div className="relative">
                        <KeyRound
                          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30"
                          aria-hidden="true"
                        />
                        <input
                          id="fireworks-key"
                          type="password"
                          value={fireworksKey}
                          onChange={(e) => {
                            setFireworksKey(e.target.value);
                            setFireworksError("");
                          }}
                          placeholder="fw_3a... "
                          className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 transition-all duration-150"
                        />
                      </div>
                      {fireworksError && (
                        <p className="text-xs text-destructive flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
                          {fireworksError}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={validateFireworks}
                      disabled={fireworksValidating || !fireworksKey.trim()}
                      className="w-full flex items-center justify-center gap-2 bg-accent text-white font-medium rounded-xl px-5 py-3 hover:bg-accent/90 active:scale-[0.97] transition-all duration-150 disabled:opacity-50 cursor-pointer"
                    >
                      {fireworksValidating ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                          Validating…
                        </>
                      ) : (
                        <>
                          <Shield className="w-4 h-4" aria-hidden="true" />
                          Validate & Complete
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Step 3: Natively AI */}
                {step.key === "natively_ai" && !isComplete && (
                  <div className="space-y-3">
                    <a
                      href={step.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-secondary hover:text-secondary/80 transition-colors duration-150 cursor-pointer"
                    >
                      <ExternalLink className="w-4 h-4" aria-hidden="true" />
                      {step.hrefLabel}
                    </a>
                    <button
                      type="button"
                      onClick={() => markStep("natively_ai")}
                      disabled={saving}
                      className="w-full flex items-center justify-center gap-2 bg-accent text-white font-medium rounded-xl px-5 py-3 hover:bg-accent/90 active:scale-[0.97] transition-all duration-150 disabled:opacity-50 cursor-pointer"
                    >
                      {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Check className="w-4 h-4" aria-hidden="true" />
                      )}
                      I&apos;ve signed up — Mark Complete
                    </button>
                  </div>
                )}

                {/* Completed state for any step */}
                {isComplete && (
                  <div className="flex items-center gap-2 text-accent text-sm">
                    <Check className="w-4 h-4" aria-hidden="true" />
                    <span>Completed</span>
                  </div>
                )}
              </div>
            </StepCard>
          );
        })}

        {/* Step 4: GitHub & Discord — always visible after first 3 steps */}
        <div
          className={`rounded-2xl border transition-all duration-200 ${
            allThreeDone ? "border-accent/40 bg-muted/80" : "border-border/60 bg-muted/20 opacity-50"
          }`}
        >
          <div className="flex items-center gap-4 p-5">
            <div
              className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center shrink-0 ${
                githubDiscordDone
                  ? "bg-accent/15 border-accent text-accent"
                  : allThreeDone
                    ? "bg-background border-accent/50 text-accent"
                    : "bg-background border-border text-foreground/40"
              }`}
            >
              {githubDiscordDone ? (
                <Check className="w-5 h-5" aria-hidden="true" />
              ) : (
                <span className="font-heading text-sm">4</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3
                className={`font-medium ${
                  githubDiscordDone
                    ? "text-accent"
                    : allThreeDone
                      ? "text-foreground"
                      : "text-foreground/50"
                }`}
              >
                GitHub & Discord
                {githubDiscordDone && (
                  <span className="ml-2 text-xs text-accent/70 font-normal">
                    Complete
                  </span>
                )}
              </h3>
            </div>
          </div>

          {allThreeDone && !githubDiscordDone && (
            <div className="px-5 pb-5 pt-0 border-t border-border/40">
              <div className="mt-3 space-y-3">
                <p className="text-sm text-foreground/70 leading-relaxed">
                  Share your GitHub and Discord usernames so we can add you to
                  your team&apos;s repo and communication channel.
                </p>

                {/* GitHub username */}
                <div>
                  <label
                    htmlFor="github-username"
                    className="text-xs text-foreground/50 uppercase tracking-wider block mb-1.5"
                  >
                    GitHub Username
                  </label>
                  <div className="relative">
                    <Github
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30"
                      aria-hidden="true"
                    />
                    <input
                      id="github-username"
                      type="text"
                      value={githubUsername}
                      onChange={(e) => setGithubUsername(e.target.value)}
                      placeholder="your-github-handle"
                      className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 transition-all duration-150"
                    />
                  </div>
                </div>

                {/* Discord username */}
                <div>
                  <label
                    htmlFor="discord-username"
                    className="text-xs text-foreground/50 uppercase tracking-wider block mb-1.5"
                  >
                    Discord Username
                  </label>
                  <div className="relative">
                    <SiDiscord
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30"
                      aria-hidden="true"
                    />
                    <input
                      id="discord-username"
                      type="text"
                      value={discordUsername}
                      onChange={(e) => setDiscordUsername(e.target.value)}
                      placeholder="your_discord_handle"
                      className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 transition-all duration-150"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={saveGitHubDiscord}
                  disabled={
                    saving ||
                    !githubUsername.trim() ||
                    !discordUsername.trim()
                  }
                  className="w-full flex items-center justify-center gap-2 bg-accent text-white font-medium rounded-xl px-5 py-3 hover:bg-accent/90 active:scale-[0.97] transition-all duration-150 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Check className="w-4 h-4" aria-hidden="true" />
                  )}
                  Save & Finish
                </button>
              </div>
            </div>
          )}

          {githubDiscordDone && (
            <div className="px-5 pb-5 pt-0 border-t border-border/40">
              <div className="mt-3 space-y-3">
                <div className="flex items-center gap-2 text-accent text-sm">
                  <Check className="w-4 h-4" aria-hidden="true" />
                  <span>Usernames saved</span>
                </div>
                {githubUsername && (
                  <div className="flex items-center gap-2 text-sm text-foreground/70">
                    <Github className="w-4 h-4 text-foreground/40" aria-hidden="true" />
                    <span className="font-mono">{githubUsername}</span>
                  </div>
                )}
                {discordUsername && (
                  <div className="flex items-center gap-2 text-sm text-foreground/70">
                    <MessageSquare className="w-4 h-4 text-foreground/40" aria-hidden="true" />
                    <span className="font-mono">{discordUsername}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {!allThreeDone && (
            <div className="px-5 pb-5 pt-0 border-t border-border/40">
              <p className="text-sm text-foreground/40 mt-3">
                Complete steps 1–3 above first, then enter your GitHub and Discord
                usernames here.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
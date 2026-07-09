import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useCurrentParticipant } from "../hooks/useAuth";
import { DISCORD_INVITE_URL } from "../lib/config";
import type { Tables } from "../lib/database.types";
import {
  Loader2,
  Check,
  ExternalLink,
  AlertCircle,
  User,
  Clock,
} from "lucide-react";
import { SiDiscord, SiGithub } from "react-icons/si";

/* ── Types ─────────────────────────────────────────── */

type StepsCompleted = {
  amd: boolean;
  fireworks: boolean;
  natively_ai: boolean;
  discord: boolean;
  github: boolean;
};

interface StepDef {
  key: keyof StepsCompleted;
  label: string;
  description: string;
  href?: string;
  hrefLabel?: string;
  href2?: string;
  hrefLabel2?: string;
}

const STEPS: StepDef[] = [
  {
    key: "amd",
    label: "Sign up for AMD Cloud",
    description:
      "Create an AMD Cloud account to access accelerated compute for your hackathon project.",
    href: "https://amdcloud.amd.com/",
    hrefLabel: "Go to AMD Cloud →",
  },
  {
    key: "fireworks",
    label: "Claim your Fireworks promo code",
    description:
      "Visit AMD DevCloud, request a Fireworks promo code, and check your email. You'll use the promo code to claim your credits.",
    href: "https://devcloud.amd.com/",
    hrefLabel: "Go to AMD DevCloud →",
  },
  {
    key: "natively_ai",
    label: "Create a Natively AI account",
    description:
      "Sign up for a Natively AI account to deploy and manage your AI pipelines.",
    href: "https://natively.ai/",
    hrefLabel: "Go to Natively AI →",
  },
  {
    key: "discord",
    label: "Join the Discord server",
    description:
      "Join the official hackathon Discord server to communicate with your team and get updates from the organizers.",
    href: DISCORD_INVITE_URL,
    hrefLabel: "Join Discord →",
  },
  {
    key: "github",
    label: "Set up your GitHub account",
    description:
      "Create a GitHub account (or sign in) so your team can collaborate on code and the organizer can add you to your team's repo.",
    href: "https://github.com/signup",
    hrefLabel: "Create GitHub account →",
    href2: "https://github.com/login",
    hrefLabel2: "Sign in to GitHub →",
  },
];

/* ── Helpers ────────────────────────────────────────── */

function getStepsCompleted(raw: unknown): StepsCompleted {
  if (typeof raw === "object" && raw !== null) {
    const r = raw as Record<string, unknown>;
    return {
      amd: Boolean(r.amd),
      fireworks: Boolean(r.fireworks),
      natively_ai: Boolean(r.natively_ai),
      discord: Boolean(r.discord),
      github: Boolean(r.github),
    };
  }
  return { amd: false, fireworks: false, natively_ai: false, discord: false, github: false };
}

/* ── Step Detail Panel ─────────────────────────────── */

function StepDetail({
  step,
  index,
  isComplete,
  saving,
  onMark,
}: {
  step: StepDef;
  index: number;
  isComplete: boolean;
  saving: boolean;
  onMark: (key: keyof StepsCompleted) => void;
}) {
  return (
    <div className="bg-muted/60 border border-border rounded-2xl p-5 space-y-4">
      {/* Step header */}
      <div className="flex items-start gap-3">
        <div
          className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all duration-200 ${
            isComplete
              ? "bg-accent border-accent text-background"
              : "bg-background border-accent/50 text-accent"
          }`}
        >
          {isComplete ? (
            <Check className="w-4 h-4" aria-hidden="true" />
          ) : (
            <span className="text-xs font-bold">{index + 1}</span>
          )}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground leading-snug">
            {step.label}
          </h3>
          {isComplete && (
            <span className="inline-flex items-center gap-1 text-xs text-accent mt-0.5">
              <Check className="w-3 h-3" />
              Done
            </span>
          )}
        </div>
      </div>

      <p className="text-sm text-foreground/60 leading-relaxed pl-11">
        {step.description}
      </p>

      {/* Links */}
      {!isComplete && (
        <div className="pl-11 space-y-2">
          {step.href && (
            <a
              href={step.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-secondary hover:text-secondary/80 transition-colors duration-150"
            >
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              {step.hrefLabel}
            </a>
          )}
          {step.href2 && step.hrefLabel2 && (
            <a
              href={step.href2}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-secondary hover:text-secondary/80 transition-colors duration-150 block"
            >
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              {step.hrefLabel2}
            </a>
          )}

          <button
            type="button"
            onClick={() => onMark(step.key)}
            disabled={saving}
            className="mt-2 flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-background text-sm font-semibold hover:bg-accent/90 active:scale-[0.97] transition-all duration-150 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="w-4 h-4" aria-hidden="true" />
            )}
            Mark as done
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Main Wizard ───────────────────────────────────── */

export default function WizardPlaceholder() {
  const { participant, loading: participantLoading } = useCurrentParticipant();
  const navigate = useNavigate();
  const [steps, setSteps] = useState<StepsCompleted>({
    amd: false,
    fireworks: false,
    natively_ai: false,
    discord: false,
    github: false,
  });
  const [team, setTeam] = useState<Tables<"teams"> | null>(null);
  const [teammates, setTeammates] = useState<Tables<"participants">[]>([]);
  const [hackathonName, setHackathonName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [infraCreating, setInfraCreating] = useState(false);
  const [infraResult, setInfraResult] = useState<{
    github_repo_url: string | null;
    discord_channel_id: string | null;
    discord_guild_id: string | null;
    github_error: string | null;
    discord_error: string | null;
    status: string;
  } | null>(null);

  const completedCount = STEPS.filter((s) => steps[s.key]).length;
  const allDone = completedCount === STEPS.length;

  // Load participant data
  useEffect(() => {
    if (!participant) return;

    const parsed = getStepsCompleted(participant.steps_completed);
    setSteps(parsed);

    // Open first incomplete step by default
    const firstIncomplete = STEPS.findIndex((s) => !parsed[s.key]);
    setActiveStep(firstIncomplete === -1 ? null : firstIncomplete);

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

  // Redirect to /register when all steps are done and infra is settled
  useEffect(() => {
    if (!allDone) return;
    const teamHasInfra =
      team?.is_approved || team?.github_repo_url || team?.discord_channel_id;
    if (infraResult || teamHasInfra) {
      const timer = setTimeout(() => navigate("/register"), 2500);
      return () => clearTimeout(timer);
    }
  }, [allDone, infraResult, team, navigate]);

  /* ── Mark step complete ──────────────────────────── */

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

      await supabase.from("audit_logs").insert({
        hackathon_id: participant.hackathon_id,
        actor_id: participant.id,
        actor_role: "participant",
        action: "step_completed",
        metadata: { step: key },
      });

      setSteps(updated);
      setSaving(false);

      const nowAllDone = STEPS.every((s) => updated[s.key]);

      if (nowAllDone && participant.team_id) {
        setInfraCreating(true);
        const { data: infraResp, error: infraErr } = await supabase.functions.invoke(
          "create-team-infrastructure",
          { body: { team_id: participant.team_id } }
        );
        setInfraCreating(false);

        if (infraErr || !infraResp) {
          setInfraResult({
            github_repo_url: null,
            discord_channel_id: null,
            discord_guild_id: null,
            github_error: infraErr?.message ?? "Could not reach infrastructure service",
            discord_error: infraErr?.message ?? "Could not reach infrastructure service",
            status: "error",
          });
        } else {
          setInfraResult(infraResp as typeof infraResult);
        }

        const { data: updatedTeam } = await supabase
          .from("teams")
          .select("*")
          .eq("id", participant.team_id)
          .single();
        if (updatedTeam) setTeam(updatedTeam);
      } else {
        // Auto-advance to the next incomplete step
        const nextIdx = STEPS.findIndex((s) => !updated[s.key]);
        setActiveStep(nextIdx === -1 ? null : nextIdx);
      }
    },
    [participant, steps, infraResult]
  );

  /* ── Loading ─────────────────────────────────────── */

  if (participantLoading) {
    return (
      <div
        className="flex items-center justify-center min-h-[50vh]"
        role="status"
        aria-label="Loading"
      >
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

  /* ── All done banner ─────────────────────────────── */

  const AllDoneBanner = allDone ? (
    <div className="flex items-center gap-3 bg-accent/10 border border-accent/30 rounded-2xl px-5 py-4 mb-6 text-sm text-accent">
      <Clock className="w-4 h-4 shrink-0 animate-pulse" aria-hidden="true" />
      <span>
        All steps complete! Setting up your team infrastructure and redirecting
        you to the home page…
      </span>
    </div>
  ) : null;

  /* ── Main Layout ─────────────────────────────────── */

  return (
    <div className="max-w-5xl mx-auto">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="font-heading text-xl text-foreground tracking-wider uppercase">
          {hackathonName || "Hackathon Setup"}
        </h1>
        <p className="text-foreground/50 text-sm mt-1">
          Welcome, {participant.name} — complete each step below to get your
          team ready.
        </p>
      </div>

      {AllDoneBanner}

      {/* Error banner */}
      {saveError && (
        <div className="flex items-center gap-3 bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 mb-6 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          {saveError}
        </div>
      )}

      {/* Infra creating banner */}
      {infraCreating && (
        <div className="flex items-center gap-3 bg-accent/5 border border-accent/20 rounded-xl px-4 py-3 mb-6 text-sm text-accent">
          <Loader2 className="w-4 h-4 shrink-0 animate-spin" aria-hidden="true" />
          Setting up your team&apos;s GitHub repo and Discord channel…
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">

        {/* ── Left: Step detail panel ── */}
        <div className="space-y-4">
          {/* If a step is selected, show its detail */}
          {activeStep !== null && !allDone ? (
            <StepDetail
              step={STEPS[activeStep]}
              index={activeStep}
              isComplete={steps[STEPS[activeStep].key]}
              saving={saving}
              onMark={markStep}
            />
          ) : allDone ? (
            /* All done — show team infrastructure result */
            <div className="bg-muted/60 border border-border rounded-2xl p-6 space-y-4">
              <h2 className="font-heading text-sm tracking-wider text-accent uppercase">
                Team Infrastructure
              </h2>

              {/* GitHub repo */}
              {(team?.github_repo_url || infraResult?.github_repo_url) ? (
                <a
                  href={team?.github_repo_url ?? infraResult?.github_repo_url ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-secondary hover:text-secondary/80 transition-colors duration-150"
                >
                  <SiGithub className="w-4 h-4" aria-hidden="true" />
                  View team GitHub repo
                  <ExternalLink className="w-3 h-3" aria-hidden="true" />
                </a>
              ) : infraResult?.github_error ? (
                <p className="text-sm text-foreground/50">
                  GitHub repo: {infraResult.github_error}
                </p>
              ) : null}

              {/* Discord channel */}
              {(team?.discord_channel_id || infraResult?.discord_channel_id) ? (
                <a
                  href={`https://discord.com/channels/${
                    infraResult?.discord_guild_id ?? "@me"
                  }/${infraResult?.discord_channel_id ?? team?.discord_channel_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-[#5865F2] hover:text-[#4752C4] transition-colors duration-150"
                >
                  <SiDiscord className="w-4 h-4" aria-hidden="true" />
                  Open team Discord channel
                  <ExternalLink className="w-3 h-3" aria-hidden="true" />
                </a>
              ) : infraResult?.discord_error ? (
                <p className="text-sm text-foreground/50">
                  Discord channel: {infraResult.discord_error}
                </p>
              ) : null}

              {infraResult?.status === "incomplete" && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-secondary/5 border border-secondary/10 text-secondary text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>
                    Waiting for all teammates to complete their steps before
                    creating your team infrastructure.
                  </span>
                </div>
              )}
            </div>
          ) : (
            /* No step selected yet */
            <div className="bg-muted/40 border border-border/40 rounded-2xl p-8 text-center text-foreground/40 text-sm">
              Select a step from the checklist to get started.
            </div>
          )}

          {/* Team card */}
          <div className="bg-muted/60 border border-border rounded-2xl p-5">
            <h2 className="font-heading text-xs tracking-wider text-accent uppercase mb-3">
              Your Team
            </h2>
            <p className="text-base font-semibold text-foreground">
              {team?.name ?? participant.name}
            </p>
            <p className="text-foreground/40 text-xs font-mono mt-0.5">
              {participant.email}
            </p>

            {teammates.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border/40 space-y-2">
                <p className="text-xs text-foreground/40 uppercase tracking-wider">
                  Teammates
                </p>
                {teammates.map((t) => (
                  <div key={t.id} className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-background border border-border flex items-center justify-center shrink-0">
                      <User className="w-3.5 h-3.5 text-foreground/40" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-sm text-foreground/80 leading-none">{t.name}</p>
                      <p className="text-xs text-foreground/40 font-mono mt-0.5">{t.email}</p>
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
                className="mt-3 inline-flex items-center gap-1.5 text-xs text-secondary hover:text-secondary/80 transition-colors duration-150"
              >
                <SiGithub className="w-3.5 h-3.5" aria-hidden="true" />
                Team repo
                <ExternalLink className="w-3 h-3" aria-hidden="true" />
              </a>
            )}
          </div>
        </div>

        {/* ── Right: Checklist panel (lablab.ai style) ── */}
        <div className="bg-muted/60 border border-border rounded-2xl p-5 lg:sticky lg:top-6">
          {/* Panel header */}
          <h2 className="text-sm font-semibold text-foreground mb-1">
            Team Progress Checklist
          </h2>
          <p className="text-xs text-foreground/50 mb-5 leading-relaxed">
            Follow each step to keep your team on track and ready for
            submission.
          </p>

          {/* Progress bar */}
          <div className="w-full bg-border rounded-full h-1 mb-5 overflow-hidden">
            <div
              className="h-1 rounded-full bg-accent transition-all duration-500"
              style={{ width: `${(completedCount / STEPS.length) * 100}%` }}
              role="progressbar"
              aria-valuenow={completedCount}
              aria-valuemin={0}
              aria-valuemax={STEPS.length}
              aria-label={`${completedCount} of ${STEPS.length} steps complete`}
            />
          </div>

          {/* Checklist items */}
          <ol className="space-y-1" aria-label="Setup checklist">
            {STEPS.map((step, i) => {
              const isComplete = steps[step.key];
              const isActive = activeStep === i;

              return (
                <li key={step.key}>
                  <button
                    type="button"
                    onClick={() => setActiveStep(isActive ? null : i)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 group ${
                      isActive
                        ? "bg-accent/10 border border-accent/20"
                        : "border border-transparent hover:bg-background/60"
                    }`}
                    aria-current={isActive ? "step" : undefined}
                  >
                    {/* Number / check circle */}
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold transition-all duration-200 ${
                        isComplete
                          ? "bg-accent text-background"
                          : isActive
                            ? "border-2 border-accent text-accent bg-background"
                            : "border-2 border-border/60 text-foreground/40 bg-background"
                      }`}
                      aria-hidden="true"
                    >
                      {isComplete ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <span>{i + 1}</span>
                      )}
                    </div>

                    {/* Label */}
                    <span
                      className={`text-sm flex-1 leading-snug transition-colors duration-150 ${
                        isComplete
                          ? "text-foreground/50 line-through"
                          : isActive
                            ? "text-foreground font-medium"
                            : "text-foreground/70 group-hover:text-foreground"
                      }`}
                    >
                      {step.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          {/* Footer count */}
          <div className="mt-5 pt-4 border-t border-border/40 flex items-center justify-between text-xs text-foreground/40">
            <span>{completedCount} of {STEPS.length} complete</span>
            {allDone && (
              <span className="text-accent font-medium flex items-center gap-1">
                <Check className="w-3 h-3" />
                All done!
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

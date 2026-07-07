import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { Tables } from "../lib/database.types";
import {
  Loader2,
  Check,
  X,
  ExternalLink,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Users,
  Trophy,
  Shield,
  User,
} from "lucide-react";
import { SiDiscord, SiGithub } from "react-icons/si";

/* ── Types ─────────────────────────────────────────── */

type StepsCompleted = {
  amd: boolean;
  fireworks: boolean;
  natively_ai: boolean;
};

interface ParticipantWithSteps extends Tables<"participants"> {
  steps: StepsCompleted;
}

interface TeamWithParticipants extends Tables<"teams"> {
  participants: ParticipantWithSteps[];
  completionPct: number;
  ready: boolean;
}

/* ── Helpers ────────────────────────────────────────── */

function parseSteps(raw: unknown): StepsCompleted {
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

function calcCompletionPct(participants: ParticipantWithSteps[]): number {
  if (participants.length === 0) return 0;
  const totalSteps = participants.length * 3;
  const done = participants.reduce(
    (sum, p) =>
      sum +
      (p.steps.amd ? 1 : 0) +
      (p.steps.fireworks ? 1 : 0) +
      (p.steps.natively_ai ? 1 : 0),
    0
  );
  return Math.round((done / totalSteps) * 100);
}

function allStepsDone(p: ParticipantWithSteps): boolean {
  return p.steps.amd && p.steps.fireworks && p.steps.natively_ai;
}

/* ── Step Badge ─────────────────────────────────────── */

function StepBadge({ done, label }: { done: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border transition-all duration-150 ${
        done
          ? "bg-accent/10 border-accent/30 text-accent"
          : "bg-muted border-border text-foreground/40"
      }`}
    >
      {done ? (
        <Check className="w-3 h-3" aria-hidden="true" />
      ) : (
        <span className="w-3 h-3 inline-flex items-center justify-center text-[10px]">
          &ndash;
        </span>
      )}
      {label}
    </span>
  );
}

/* ── Status Badge ───────────────────────────────────── */

function StatusBadge({
  status,
}: {
  status: "pending" | "ready" | "approved";
}) {
  const styles: Record<string, string> = {
    pending: "bg-amber/10 border-amber/30 text-amber",
    ready: "bg-accent/10 border-accent/30 text-accent",
    approved: "bg-secondary/10 border-secondary/30 text-secondary",
  };
  const labels: Record<string, string> = {
    pending: "Pending",
    ready: "Ready",
    approved: "Approved",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status] ?? styles.pending}`}
    >
      {labels[status] ?? status}
    </span>
  );
}

/* ── Approve Result Modal ───────────────────────────── */

function ApproveResultModal({
  result,
  onClose,
  onRetry,
  retrying,
}: {
  result: {
    team_id: string;
    team_name: string;
    github_repo_url: string | null;
    github_error: string | null;
    discord_channel_id: string | null;
    discord_error: string | null;
    status: string;
  } | null;
  onClose: () => void;
  onRetry: () => void;
  retrying: boolean;
}) {
  if (!result) return null;

  const hasGithub = !!result.github_repo_url;
  const hasDiscord = !!result.discord_channel_id;
  const hasErrors = result.github_error || result.discord_error;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Infrastructure creation result"
    >
      <div
        className="w-full max-w-md bg-background border border-border rounded-2xl p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-heading text-lg text-foreground tracking-wider uppercase mb-4">
          {result.status === "complete"
            ? "Team Approved!"
            : result.status === "partial"
              ? "Partially Completed"
              : "Creation Failed"}
        </h2>

        <p className="text-sm text-foreground/70 mb-4">
          Team <span className="font-medium text-foreground">{result.team_name}</span>
        </p>

        {/* GitHub Result */}
        <div
          className={`rounded-xl border p-4 mb-3 ${
            hasGithub
              ? "bg-accent/5 border-accent/20"
              : "bg-destructive/5 border-destructive/20"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-foreground/60 uppercase tracking-wider flex items-center gap-1.5">
              <SiGithub className="w-3.5 h-3.5" aria-hidden="true" />
              GitHub Repository
            </span>
            {hasGithub ? (
              <Check className="w-4 h-4 text-accent" aria-hidden="true" />
            ) : (
              <X className="w-4 h-4 text-destructive" aria-hidden="true" />
            )}
          </div>
          {hasGithub ? (
            <a
              href={result.github_repo_url!}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-secondary hover:text-secondary/80 flex items-center gap-1 cursor-pointer"
            >
              {result.github_repo_url}
              <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </a>
          ) : (
            <p className="text-xs text-destructive/80">{result.github_error}</p>
          )}
        </div>

        {/* Discord Result */}
        <div
          className={`rounded-xl border p-4 mb-4 ${
            hasDiscord
              ? "bg-accent/5 border-accent/20"
              : "bg-destructive/5 border-destructive/20"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-foreground/60 uppercase tracking-wider flex items-center gap-1.5">
              <SiDiscord className="w-3.5 h-3.5" aria-hidden="true" />
              Discord Channel
            </span>
            {hasDiscord ? (
              <Check className="w-4 h-4 text-accent" aria-hidden="true" />
            ) : (
              <X className="w-4 h-4 text-destructive" aria-hidden="true" />
            )}
          </div>
          {hasDiscord ? (
            <p className="text-sm text-foreground/70">
              Channel ID: <span className="font-mono text-xs">{result.discord_channel_id}</span>
            </p>
          ) : (
            <p className="text-xs text-destructive/80">{result.discord_error}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm text-foreground/70 hover:bg-muted transition-all duration-150 cursor-pointer"
          >
            Close
          </button>
          {hasErrors && (
            <button
              type="button"
              onClick={onRetry}
              disabled={retrying}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 active:scale-[0.97] transition-all duration-150 disabled:opacity-50 cursor-pointer"
            >
              {retrying ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="w-4 h-4" aria-hidden="true" />
              )}
              Retry Failed
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Main Dashboard ────────────────────────────────── */

export default function DashboardPlaceholder() {
  const [organizerId, setOrganizerId] = useState<string | null>(null);
  const [selectedHackathonId, setSelectedHackathonId] = useState<
    string | null
  >(null);
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const [approvingTeam, setApprovingTeam] = useState<string | null>(null);
  const [approveResult, setApproveResult] = useState<{
    team_id: string;
    team_name: string;
    github_repo_url: string | null;
    github_error: string | null;
    discord_channel_id: string | null;
    discord_error: string | null;
    status: string;
  } | null>(null);
  const [retrying, setRetrying] = useState(false);

  // Get organizer ID
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) return;
      const { data } = await supabase
        .from("organizers")
        .select("id")
        .eq("auth_user_id", session.user.id)
        .maybeSingle();
      if (data) setOrganizerId(data.id);
    });
  }, []);

  // Fetch organizer's hackathons
  const {
    data: hackathons,
    isLoading: hackathonsLoading,
  } = useQuery({
    queryKey: ["organizer-hackathons", organizerId],
    queryFn: async () => {
      if (!organizerId) return [];
      const { data: links } = await supabase
        .from("organizer_hackathons")
        .select("hackathon_id")
        .eq("organizer_id", organizerId);

      if (!links || links.length === 0) return [];

      const hackIds = links.map((l) => l.hackathon_id);
      const { data: hack } = await supabase
        .from("hackathons")
        .select("*")
        .in("id", hackIds)
        .order("created_at", { ascending: false });

      return (hack ?? []) as Tables<"hackathons">[];
    },
    enabled: !!organizerId,
  });

  // Auto-select first hackathon
  useEffect(() => {
    if (hackathons && hackathons.length > 0 && !selectedHackathonId) {
      setSelectedHackathonId(hackathons[0].id);
    }
  }, [hackathons, selectedHackathonId]);

  // Selected hackathon data
  const selectedHackathon = hackathons?.find(
    (h) => h.id === selectedHackathonId
  );

  // Fetch teams with participants for the selected hackathon
  const {
    data: teams,
    isLoading: teamsLoading,
    refetch: refetchTeams,
  } = useQuery({
    queryKey: ["hackathon-teams", selectedHackathonId],
    queryFn: async () => {
      if (!selectedHackathonId) return [];

      const { data: teamData } = await supabase
        .from("teams")
        .select("*")
        .eq("hackathon_id", selectedHackathonId)
        .order("name", { ascending: true });

      if (!teamData || teamData.length === 0) return [];

      const { data: participantData } = await supabase
        .from("participants")
        .select("*")
        .eq("hackathon_id", selectedHackathonId);

      const participantsByTeam = new Map<string, ParticipantWithSteps[]>();
      for (const p of participantData ?? []) {
        const withSteps: ParticipantWithSteps = {
          ...p,
          steps: parseSteps(p.steps_completed),
        };
        const arr = participantsByTeam.get(p.team_id) ?? [];
        arr.push(withSteps);
        participantsByTeam.set(p.team_id, arr);
      }

      return (teamData as Tables<"teams">[]).map((t) => {
        const participants = participantsByTeam.get(t.id) ?? [];
        return {
          ...t,
          participants,
          completionPct: calcCompletionPct(participants),
          ready:
            participants.length > 0 &&
            participants.every((p) => allStepsDone(p)),
        } as TeamWithParticipants;
      });
    },
    enabled: !!selectedHackathonId,
    refetchInterval: 10_000,
  });

  /* ── Approve & Create ─────────────────────────────── */

  const approveTeam = useCallback(
    async (teamId: string) => {
      setApprovingTeam(teamId);
      setApproveResult(null);

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setApprovingTeam(null);
        return;
      }

      const { data, error } = await supabase.functions.invoke(
        "create-team-infrastructure",
        {
          body: { team_id: teamId },
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );

      setApprovingTeam(null);

      if (error) {
        setApproveResult({
          team_id: teamId,
          team_name: "",
          github_repo_url: null,
          github_error: `Failed to invoke function: ${error.message}`,
          discord_channel_id: null,
          discord_error: "",
          status: "failed",
        });
        return;
      }

      setApproveResult(data);
      await refetchTeams();
    },
    [refetchTeams]
  );

  const retryApprove = useCallback(async () => {
    if (!approveResult) return;
    setRetrying(true);
    await approveTeam(approveResult.team_id);
    setRetrying(false);
  }, [approveResult, approveTeam]);

  const toggleTeam = useCallback((teamId: string) => {
    setExpandedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  }, []);

  /* ── Loading ──────────────────────────────────────── */

  if (hackathonsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]" role="status" aria-label="Loading dashboard">
        <Loader2 className="w-6 h-6 text-accent animate-spin" aria-hidden="true" />
      </div>
    );
  }

  if (!hackathons || hackathons.length === 0) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="font-heading text-2xl text-foreground tracking-wider uppercase">
            Dashboard
          </h1>
          <p className="text-foreground/60 text-sm mt-1">
            Monitor your hackathons and participant progress
          </p>
        </div>
        <div className="bg-muted border border-border rounded-2xl p-12 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
            <Trophy className="w-6 h-6 text-accent" aria-hidden="true" />
          </div>
          <p className="text-foreground/80 font-medium">No hackathons yet</p>
          <p className="text-foreground/40 text-sm mt-1">
            Head over to{" "}
            <Link
              to="/hackathons"
              className="text-accent hover:underline cursor-pointer"
            >
              Hackathons
            </Link>{" "}
            to create your first one.
          </p>
        </div>
      </div>
    );
  }

  /* ── Stats ────────────────────────────────────────── */

  const totalTeams = teams?.length ?? 0;
  const readyTeams = teams?.filter((t) => t.ready).length ?? 0;
  const approvedTeams = teams?.filter((t) => t.is_approved).length ?? 0;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-heading text-2xl text-foreground tracking-wider uppercase">
            Dashboard
          </h1>
          <p className="text-foreground/60 text-sm mt-1">
            {selectedHackathon?.name ?? "Select a hackathon"}
          </p>
        </div>

        {/* Hackathon selector */}
        {hackathons.length > 1 && (
          <div className="relative">
            <select
              value={selectedHackathonId ?? ""}
              onChange={(e) => {
                setSelectedHackathonId(e.target.value || null);
                setExpandedTeams(new Set());
              }}
              className="appearance-none bg-muted border border-border rounded-xl px-4 py-2.5 pr-10 text-sm text-foreground focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 cursor-pointer"
              aria-label="Select hackathon"
            >
              {hackathons.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
            <ChevronDown
              className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40 pointer-events-none"
              aria-hidden="true"
            />
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-muted border border-border rounded-2xl p-5">
          <p className="text-foreground/40 text-xs font-mono uppercase tracking-wider">
            Total Teams
          </p>
          <p className="text-3xl font-heading text-foreground mt-1">
            {totalTeams}
          </p>
        </div>
        <div className="bg-muted border border-border rounded-2xl p-5">
          <p className="text-foreground/40 text-xs font-mono uppercase tracking-wider">
            Ready for Approval
          </p>
          <p className="text-3xl font-heading text-accent mt-1">
            {readyTeams}
          </p>
        </div>
        <div className="bg-muted border border-border rounded-2xl p-5">
          <p className="text-foreground/40 text-xs font-mono uppercase tracking-wider">
            Approved
          </p>
          <p className="text-3xl font-heading text-secondary mt-1">
            {approvedTeams}
          </p>
        </div>
      </div>

      {/* Teams table */}
      {teamsLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-accent animate-spin" aria-hidden="true" />
        </div>
      ) : !teams || teams.length === 0 ? (
        <div className="bg-muted border border-border rounded-2xl p-12 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-amber/10 border border-amber/20 flex items-center justify-center">
            <Users className="w-6 h-6 text-amber" aria-hidden="true" />
          </div>
          <p className="text-foreground/80 font-medium">No teams yet</p>
          <p className="text-foreground/40 text-sm mt-1 max-w-md mx-auto">
            Import teams from the Hackathons page to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Table header */}
          <div className="hidden lg:grid grid-cols-12 gap-3 px-5 py-3 text-xs text-foreground/40 font-medium uppercase tracking-wider">
            <div className="col-span-3">Team Name</div>
            <div className="col-span-2">Members</div>
            <div className="col-span-4">Progress</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-2">Actions</div>
          </div>

          {/* Team rows */}
          {teams.map((team) => {
            const isExpanded = expandedTeams.has(team.id);
            const isApproving = approvingTeam === team.id;

            // Team status
            let status: "pending" | "ready" | "approved" = "pending";
            if (team.is_approved) status = "approved";
            else if (team.ready) status = "ready";

            // Check participants' GitHub/Discord status
            const noGithubDiscord = team.participants.filter(
              (p) => !p.github_username || !p.discord_username
            );

            return (
              <div
                key={team.id}
                className={`bg-muted border rounded-2xl overflow-hidden transition-all duration-200 ${
                  isExpanded
                    ? "border-accent/30"
                    : team.is_approved
                      ? "border-secondary/30"
                      : "border-border"
                }`}
              >
                {/* Main row */}
                <div
                  className="grid grid-cols-1 lg:grid-cols-12 gap-3 px-5 py-4 items-center cursor-pointer"
                  onClick={() => toggleTeam(team.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleTeam(team.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  aria-label={`${team.name} — ${team.participants.length} members, ${status}`}
                >
                  {/* Team name */}
                  <div className="col-span-3 flex items-center gap-3 min-w-0">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-foreground/40 shrink-0" aria-hidden="true" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-foreground/40 shrink-0" aria-hidden="true" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {team.name}
                      </p>
                      {team.github_repo_url && (
                        <a
                          href={team.github_repo_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-secondary/60 hover:text-secondary flex items-center gap-1 cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <SiGithub className="w-3 h-3" aria-hidden="true" />
                          Repo
                          <ExternalLink className="w-2.5 h-2.5" aria-hidden="true" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Members */}
                  <div className="col-span-2 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-foreground/40 shrink-0" aria-hidden="true" />
                    <span className="text-sm text-foreground/70">
                      {team.participants.length}
                    </span>
                    {team.participants.length > 0 && (
                      <div className="hidden sm:flex -space-x-1.5 ml-1">
                        {team.participants.slice(0, 4).map((p) => (
                          <div
                            key={p.id}
                            className="w-6 h-6 rounded-full bg-background border border-border flex items-center justify-center"
                            title={p.name}
                          >
                            <span className="text-[10px] text-foreground/60 font-mono">
                              {p.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .slice(0, 2)
                                .toUpperCase()}
                            </span>
                          </div>
                        ))}
                        {team.participants.length > 4 && (
                          <div className="w-6 h-6 rounded-full bg-background border border-border flex items-center justify-center">
                            <span className="text-[10px] text-foreground/40">
                              +{team.participants.length - 4}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Progress */}
                  <div className="col-span-4">
                    <div className="flex items-center gap-2">
                      <StepBadge
                        done={team.participants.every((p) => p.steps.amd)}
                        label="AMD"
                      />
                      <StepBadge
                        done={team.participants.every((p) => p.steps.fireworks)}
                        label="FW"
                      />
                      <StepBadge
                        done={team.participants.every((p) => p.steps.natively_ai)}
                        label="NvAI"
                      />
                    </div>
                    {team.participants.length > 0 && (
                      <div className="mt-1.5 w-full bg-border/40 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            team.completionPct === 100
                              ? "bg-accent"
                              : team.completionPct > 50
                                ? "bg-accent/70"
                                : "bg-amber/60"
                          }`}
                          style={{ width: `${team.completionPct}%` }}
                          aria-label={`${team.completionPct}% complete`}
                        />
                      </div>
                    )}
                  </div>

                  {/* Status */}
                  <div className="col-span-1">
                    <StatusBadge status={status} />
                  </div>

                  {/* Actions */}
                  <div className="col-span-2" onClick={(e) => e.stopPropagation()}>
                    {status === "ready" ? (
                      <button
                        type="button"
                        disabled={isApproving}
                        onClick={async (e) => {
                          e.stopPropagation();
                          await approveTeam(team.id);
                        }}
                        className="w-full flex items-center justify-center gap-2 bg-accent text-white text-sm font-medium rounded-xl px-3 py-2 hover:bg-accent/90 active:scale-[0.97] transition-all duration-150 disabled:opacity-50 cursor-pointer"
                      >
                        {isApproving ? (
                          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <Shield className="w-4 h-4" aria-hidden="true" />
                        )}
                        <span className="hidden sm:inline">Approve</span>
                      </button>
                    ) : status === "approved" ? (
                      <span className="text-xs text-secondary/60 flex items-center gap-1 justify-center">
                        <Check className="w-3.5 h-3.5" aria-hidden="true" />
                        Done
                      </span>
                    ) : (
                      <span className="text-xs text-foreground/40 flex items-center gap-1 justify-center">
                        <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                        Waiting
                      </span>
                    )}
                  </div>
                </div>

                {/* Expanded: participant details */}
                {isExpanded && (
                  <div className="border-t border-border/40 px-5 py-4">
                    {team.participants.length === 0 ? (
                      <p className="text-sm text-foreground/40 text-center py-4">
                        No participants in this team.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {team.participants.map((p) => {
                          const ghOk = !!p.github_username;
                          const dcOk = !!p.discord_username;
                          return (
                            <div
                              key={p.id}
                              className="bg-background border border-border/60 rounded-xl p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-center"
                            >
                              {/* Participant info */}
                              <div className="md:col-span-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-muted border border-border flex items-center justify-center shrink-0">
                                    <User className="w-3.5 h-3.5 text-foreground/40" aria-hidden="true" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm text-foreground truncate">
                                      {p.name}
                                    </p>
                                    <p className="text-xs text-foreground/40 font-mono truncate">
                                      {p.email}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              {/* Step checkmarks */}
                              <div className="md:col-span-4 flex items-center gap-2.5">
                                <StepBadge done={p.steps.amd} label="AMD" />
                                <StepBadge
                                  done={p.steps.fireworks}
                                  label="FW"
                                />
                                <StepBadge
                                  done={p.steps.natively_ai}
                                  label="NvAI"
                                />
                              </div>

                              {/* GitHub / Discord */}
                              <div className="md:col-span-3 flex items-center gap-3">
                                <span
                                  className={`inline-flex items-center gap-1 text-xs ${
                                    ghOk ? "text-foreground/70" : "text-foreground/40"
                                  }`}
                                >
                                  <SiGithub className="w-3.5 h-3.5" aria-hidden="true" />
                                  {ghOk ? (
                                    p.github_username
                                  ) : (
                                    <span className="italic">missing</span>
                                  )}
                                </span>
                                <span
                                  className={`inline-flex items-center gap-1 text-xs ${
                                    dcOk ? "text-foreground/70" : "text-foreground/40"
                                  }`}
                                >
                                  <SiDiscord className="w-3.5 h-3.5" aria-hidden="true" />
                                  {dcOk ? (
                                    p.discord_username
                                  ) : (
                                    <span className="italic">missing</span>
                                  )}
                                </span>
                              </div>

                              {/* Missing GH/DC badge */}
                              {(!ghOk || !dcOk) && (
                                <div className="md:col-span-2">
                                  <span className="inline-flex items-center gap-1 text-xs bg-destructive/10 text-destructive border border-destructive/20 rounded-full px-2 py-0.5">
                                    <AlertCircle className="w-3 h-3" aria-hidden="true" />
                                    Missing profiles
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Missing GitHub/Discord summary */}
                    {noGithubDiscord.length > 0 && (
                      <div className="mt-3 flex items-center gap-2 text-xs text-amber flex-wrap">
                        <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>
                          {noGithubDiscord.length} participant
                          {noGithubDiscord.length > 1 ? "s" : ""} still needs
                          to provide GitHub & Discord usernames
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Approve Result Modal */}
      <ApproveResultModal
        result={approveResult}
        onClose={() => {
          setApproveResult(null);
          refetchTeams();
        }}
        onRetry={retryApprove}
        retrying={retrying}
      />
    </div>
  );
}
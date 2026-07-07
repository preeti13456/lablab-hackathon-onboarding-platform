import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface CreateInfraRequest {
  team_id: string;
}

interface Participant {
  id: string;
  name: string;
  email: string;
  steps_completed: Record<string, boolean>;
  github_username: string | null;
  discord_username: string | null;
}

interface Team {
  id: string;
  name: string;
  hackathon_id: string;
  is_approved: boolean;
  github_repo_url: string | null;
  discord_channel_id: string | null;
}

interface Hackathon {
  id: string;
  name: string;
  slug: string;
  github_org: string | null;
  discord_server_id: string | null;
}

/* ── Rate limiter ─────────────────────────────────── */

const rateLimitStore = new Map<string, number[]>();

function checkRateLimit(hackathonId: string): boolean {
  const now = Date.now();
  const window = 60_000;
  const maxCalls = 5;

  let timestamps = rateLimitStore.get(hackathonId);
  if (!timestamps) {
    timestamps = [];
    rateLimitStore.set(hackathonId, timestamps);
  }

  const recent = timestamps.filter((t) => now - t < window);
  rateLimitStore.set(hackathonId, recent);

  if (recent.length >= maxCalls) return false;

  recent.push(now);
  return true;
}

/* ── Helpers ───────────────────────────────────────── */

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

async function createGitHubRepo(
  teamName: string,
  hackathonSlug: string,
  githubOrg: string | null,
  pat: string,
  templateOwner: string,
  templateRepo: string
): Promise<{ url: string | null; error: string | null }> {
  const repoName = `${hackathonSlug}-${slugify(teamName)}`;

  const useTemplate = templateOwner && templateRepo;

  const endpoint = useTemplate
    ? `https://api.github.com/repos/${templateOwner}/${templateRepo}/generate`
    : githubOrg
      ? `https://api.github.com/orgs/${githubOrg}/repos`
      : `https://api.github.com/user/repos`;

  const body: Record<string, unknown> = useTemplate
    ? {
        owner: githubOrg || templateOwner,
        name: repoName,
        description: `Team ${teamName} — ${hackathonSlug} Hackathon`,
        include_all_branches: false,
        private: true,
      }
    : {
        name: repoName,
        description: `Team ${teamName} — ${hackathonSlug} Hackathon`,
        private: true,
        auto_init: true,
      };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "hackathon-onboarding",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => "Unknown error");
      return {
        url: null,
        error: `GitHub API (${response.status}): ${errBody.slice(0, 300)}`,
      };
    }

    const data = await response.json();
    return { url: data.html_url as string, error: null };
  } catch (err) {
    return {
      url: null,
      error: `GitHub request failed: ${err instanceof Error ? err.message : "Unknown"}`,
    };
  }
}

async function createDiscordChannel(
  teamName: string,
  hackathonName: string,
  botToken: string,
  guildId: string,
  participantNames: string[]
): Promise<{ channelId: string | null; error: string | null }> {
  const channelName = `team-${slugify(teamName)}`;
  const topic =
    `Team ${teamName} — ${hackathonName}\nMembers: ${participantNames.join(", ")}`;

  try {
    const response = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/channels`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${botToken}`,
          "Content-Type": "application/json",
          "User-Agent": "hackathon-onboarding",
        },
        body: JSON.stringify({
          name: channelName,
          type: 0,
          topic: topic.slice(0, 1000),
          reason: `Auto-created for ${teamName}`,
        }),
      }
    );

    if (!response.ok) {
      const errBody = await response.text().catch(() => "Unknown");
      return {
        channelId: null,
        error: `Discord API (${response.status}): ${errBody.slice(0, 300)}`,
      };
    }

    const data = await response.json();
    return { channelId: data.id as string, error: null };
  } catch (err) {
    return {
      channelId: null,
      error: `Discord request failed: ${err instanceof Error ? err.message : "Unknown"}`,
    };
  }
}

/* ── Handler ───────────────────────────────────────── */

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  /* ── Auth ────────────────────────────────────── */

  const authHeader = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing Authorization" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, supabaseKey);

  const { data: { user }, error: userError } = await sb.auth.getUser(authHeader);
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  /* ── Parse body ───────────────────────────────── */

  let body: CreateInfraRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!body.team_id || typeof body.team_id !== "string") {
    return new Response(JSON.stringify({ error: "Missing team_id" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  /* ── Fetch team ───────────────────────────────── */

  const { data: team, error: teamErr } = await sb
    .from("teams")
    .select("*")
    .eq("id", body.team_id)
    .single();

  if (teamErr || !team) {
    return new Response(JSON.stringify({ error: "Team not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const t = team as unknown as Team;

  if (t.is_approved) {
    return new Response(
      JSON.stringify({
        error: "Already approved",
        github_repo_url: t.github_repo_url,
        discord_channel_id: t.discord_channel_id,
      }),
      { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  /* ── Fetch participants ───────────────────────── */

  const { data: participants, error: partErr } = await sb
    .from("participants")
    .select("*")
    .eq("team_id", body.team_id);

  if (partErr) {
    return new Response(JSON.stringify({ error: "DB error fetching participants" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const parts = participants as unknown as Participant[];

  if (parts.length === 0) {
    return new Response(JSON.stringify({ error: "Team has no participants" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Verify all participants completed steps 1–3
  const incomplete = parts.filter((p) => {
    const s = p.steps_completed ?? {};
    return !(s.amd && s.fireworks && s.natively_ai);
  });

  if (incomplete.length > 0) {
    return new Response(
      JSON.stringify({
        error: "Not all participants completed steps 1–3",
        incomplete_participants: incomplete.map((p) => ({
          id: p.id,
          name: p.name,
        })),
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  /* ── Fetch hackathon ──────────────────────────── */

  const { data: hack, error: hackErr } = await sb
    .from("hackathons")
    .select("*")
    .eq("id", t.hackathon_id)
    .single();

  if (hackErr || !hack) {
    return new Response(JSON.stringify({ error: "Hackathon not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const h = hack as unknown as Hackathon;

  /* ── Rate limit ───────────────────────────────── */

  if (!checkRateLimit(t.hackathon_id)) {
    return new Response(JSON.stringify({ error: "Rate limit (5/min per hackathon)" }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  /* ── Gather env vars ──────────────────────────── */

  const githubPat = Deno.env.get("GITHUB_PAT");
  const tmplOwner = Deno.env.get("GITHUB_TEMPLATE_OWNER") || "";
  const tmplRepo = Deno.env.get("GITHUB_TEMPLATE_REPO") || "";
  const discordToken = Deno.env.get("DISCORD_BOT_TOKEN");
  const discordGuild = Deno.env.get("DISCORD_GUILD_ID");

  let githubUrl: string | null = null;
  let githubErr: string | null = null;
  let discordId: string | null = null;
  let discordErr: string | null = null;

  /* ── Create GitHub repo ───────────────────────── */

  if (githubPat) {
    const result = await createGitHubRepo(
      t.name,
      h.slug,
      h.github_org || null,
      githubPat,
      tmplOwner,
      tmplRepo
    );
    githubUrl = result.url;
    githubErr = result.error;
  } else {
    githubErr = "GITHUB_PAT not configured";
  }

  /* ── Create Discord channel ───────────────────── */

  if (discordToken && discordGuild) {
    const result = await createDiscordChannel(
      t.name,
      h.name,
      discordToken,
      discordGuild,
      parts.map((p) => p.name)
    );
    discordId = result.channelId;
    discordErr = result.error;
  } else {
    discordErr = !discordToken ? "DISCORD_BOT_TOKEN not configured" : "DISCORD_GUILD_ID not configured";
  }

  /* ── Update team record ───────────────────────── */

  const updates: Record<string, unknown> = {};
  if (githubUrl) updates.github_repo_url = githubUrl;
  if (discordId) updates.discord_channel_id = discordId;

  const bothOk = githubUrl && discordId;
  const partial = (githubUrl || discordId) && !bothOk;

  if (bothOk) updates.is_approved = true;

  if (Object.keys(updates).length > 0) {
    await sb.from("teams").update(updates).eq("id", body.team_id);
  }

  /* ── Audit log ────────────────────────────────── */

  await sb.from("audit_logs").insert({
    hackathon_id: t.hackathon_id,
    actor_id: user.id,
    actor_role: "organizer",
    action: "create_infrastructure",
    metadata: {
      team_id: body.team_id,
      team_name: t.name,
      github_repo_url: githubUrl,
      discord_channel_id: discordId,
      github_error: githubErr,
      discord_error: discordErr,
      status: bothOk ? "complete" : partial ? "partial" : "failed",
    },
  });

  /* ── Response ─────────────────────────────────── */

  const statusCode = bothOk ? 200 : partial ? 207 : 500;

  return new Response(
    JSON.stringify({
      team_id: body.team_id,
      team_name: t.name,
      github_repo_url: githubUrl,
      github_error: githubErr,
      discord_channel_id: discordId,
      discord_error: discordErr,
      status: bothOk ? "complete" : partial ? "partial" : "failed",
    }),
    { status: statusCode, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
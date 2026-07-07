import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/* ── Types ─────────────────────────────────────────── */

interface ImportRow {
  team_name: string;
  participant_name: string;
  participant_email: string;
  github_username?: string;
  discord_username?: string;
}

interface ImportRequest {
  hackathon_id: string;
  data: ImportRow[];
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

interface ImportResult {
  success: boolean;
  teams_created: number;
  participants_created: number;
  teams_skipped: number;
  participants_skipped: number;
  errors: ValidationError[];
  summary: string;
}

/* ── Helpers ────────────────────────────────────────── */

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

/* ── Main Handler ───────────────────────────────────── */

Deno.serve(async (req: Request) => {
  // Verify JWT
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Create Supabase client with the user's JWT
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  // Verify the user is an organizer
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Check they are an organizer
  const { data: organizer } = await supabase
    .from("organizers")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!organizer) {
    return new Response(JSON.stringify({ error: "Only organizers can import teams" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Verify they own this hackathon
  const { data: link } = await supabase
    .from("organizer_hackathons")
    .select("id")
    .eq("organizer_id", organizer.id)
    .eq("hackathon_id", hackathon_id)
    .maybeSingle();

  if (!link) {
    return new Response(
      JSON.stringify({ error: "You do not have access to this hackathon" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  // Parse and validate request body
  let body: ImportRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { hackathon_id, data: rows } = body;
  if (!hackathon_id || !rows || !Array.isArray(rows) || rows.length === 0) {
    return new Response(
      JSON.stringify({
        success: false,
        errors: [{ row: 0, field: "body", message: "Request must include hackathon_id and a non-empty data array" }],
        teams_created: 0,
        participants_created: 0,
        teams_skipped: 0,
        participants_skipped: 0,
        summary: "No data to import.",
      } satisfies ImportResult),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Validate rows
  const errors: ValidationError[] = [];
  const validRows: { row: number; data: ImportRow }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 1;
    let rowValid = true;

    if (!r.team_name || r.team_name.trim() === "") {
      errors.push({ row: rowNum, field: "team_name", message: "Team name is required" });
      rowValid = false;
    }
    if (!r.participant_name || r.participant_name.trim() === "") {
      errors.push({ row: rowNum, field: "participant_name", message: "Participant name is required" });
      rowValid = false;
    }
    if (!r.participant_email || r.participant_email.trim() === "") {
      errors.push({ row: rowNum, field: "participant_email", message: "Participant email is required" });
      rowValid = false;
    } else if (!isValidEmail(r.participant_email.trim())) {
      errors.push({ row: rowNum, field: "participant_email", message: "Invalid email format" });
      rowValid = false;
    }

    if (rowValid) {
      validRows.push({
        row: rowNum,
        data: {
          team_name: r.team_name.trim(),
          participant_name: r.participant_name.trim(),
          participant_email: r.participant_email.trim().toLowerCase(),
          github_username: r.github_username?.trim() || undefined,
          discord_username: r.discord_username?.trim() || undefined,
        },
      });
    }
  }

  if (validRows.length === 0) {
    return new Response(
      JSON.stringify({
        success: false,
        teams_created: 0,
        participants_created: 0,
        teams_skipped: 0,
        participants_skipped: 0,
        errors,
        summary: "All rows had validation errors.",
      } satisfies ImportResult),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Check for duplicate emails already in this hackathon
  const allEmails = validRows.map((r) => r.data.participant_email);
  const { data: existingParticipants } = await supabase
    .from("participants")
    .select("email")
    .eq("hackathon_id", hackathon_id)
    .in("email", allEmails);

  const existingEmailSet = new Set((existingParticipants ?? []).map((p) => p.email));

  // Check for duplicate emails within the same import batch
  const seenEmails = new Set<string>();
  const rowsWithoutDupes = validRows.filter((r) => {
    if (existingEmailSet.has(r.data.participant_email)) {
      errors.push({ row: r.row, field: "participant_email", message: `Email "${r.data.participant_email}" already exists in this hackathon` });
      return false;
    }
    if (seenEmails.has(r.data.participant_email)) {
      errors.push({ row: r.row, field: "participant_email", message: `Duplicate email "${r.data.participant_email}" in import data` });
      return false;
    }
    seenEmails.add(r.data.participant_email);
    return true;
  });

  if (rowsWithoutDupes.length === 0) {
    return new Response(
      JSON.stringify({
        success: false,
        teams_created: 0,
        participants_created: 0,
        teams_skipped: 0,
        participants_skipped: 0,
        errors,
        summary: "All valid rows had duplicate emails.",
      } satisfies ImportResult),
      { status: 409, headers: { "Content-Type": "application/json" } }
    );
  }

  // Group valid rows by team name
  const teamGroups = new Map<string, typeof rowsWithoutDupes>();
  for (const row of rowsWithoutDupes) {
    const existing = teamGroups.get(row.data.team_name) ?? [];
    existing.push(row);
    teamGroups.set(row.data.team_name, existing);
  }

  // Get existing teams for this hackathon (to deduplicate)
  const { data: existingTeams } = await supabase
    .from("teams")
    .select("id, name")
    .eq("hackathon_id", hackathon_id);

  const existingTeamMap = new Map((existingTeams ?? []).map((t) => [t.name, t.id]));

  let teamsCreated = 0;
  let teamsSkipped = 0;
  let participantsCreated = 0;
  let participantsSkipped = 0;

  // Process each team group
  for (const [teamName, members] of teamGroups) {
    let teamId = existingTeamMap.get(teamName);

    if (!teamId) {
      // Create the team
      const { data: newTeam, error: teamError } = await supabase
        .from("teams")
        .insert({
          hackathon_id,
          name: teamName,
        })
        .select("id")
        .single();

      if (teamError || !newTeam) {
        // Log the error for each member
        for (const m of members) {
          errors.push({
            row: m.row,
            field: "team",
            message: `Failed to create team "${teamName}": ${teamError?.message ?? "unknown error"}`,
          });
          participantsSkipped++;
        }
        continue;
      }
      teamId = newTeam.id;
      teamsCreated++;
    } else {
      teamsSkipped++;
    }

    // Create participants for this team
    for (const m of members) {
      const { error: participantError } = await supabase.from("participants").insert({
        hackathon_id,
        team_id: teamId,
        name: m.data.participant_name,
        email: m.data.participant_email,
        github_username: m.data.github_username ?? null,
        discord_username: m.data.discord_username ?? null,
        steps_completed: { amd: false, fireworks: false, natively_ai: false },
      });

      if (participantError) {
        errors.push({
          row: m.row,
          field: "participant",
          message: `Failed to create participant "${m.data.participant_name}": ${participantError.message}`,
        });
        participantsSkipped++;
      } else {
        participantsCreated++;
      }
    }
  }

  // Audit log
  await supabase.from("audit_logs").insert({
    hackathon_id,
    actor_id: organizer.id,
    actor_role: "organizer",
    action: "import_teams",
    metadata: {
      rows_total: rows.length,
      teams_created: teamsCreated,
      participants_created: participantsCreated,
      errors_count: errors.length,
    },
  });

  const totalExpected = rowsWithoutDupes.length;
  const hasErrors = errors.length > 0;

  return new Response(
    JSON.stringify({
      success: !hasErrors,
      teams_created: teamsCreated,
      participants_created: participantsCreated,
      teams_skipped: teamsSkipped,
      participants_skipped: participantsSkipped,
      errors,
      summary: hasErrors
        ? `Imported ${participantsCreated} participants across ${teamsCreated + teamsSkipped} teams. ${errors.length} error${errors.length === 1 ? "" : "s"}.`
        : `Successfully imported ${participantsCreated} participants across ${teamsCreated + teamsSkipped} teams.`,
    } satisfies ImportResult),
    { status: hasErrors ? 207 : 200, headers: { "Content-Type": "application/json" } }
  );
});
// Authentication & authorization hooks
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type { Tables } from "../lib/database.types";

type AuthState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "authenticated"; user: User; role: "participant" | "organizer" | "unknown" };

export function useAuth() {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) {
        setState({ status: "unauthenticated" });
        return;
      }
      const role = await resolveRole(session.user.id, session.user.email ?? "");
      setState({ status: "authenticated", user: session.user, role });
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.user) {
        setState({ status: "unauthenticated" });
        return;
      }
      const role = await resolveRole(session.user.id, session.user.email ?? "");
      setState({ status: "authenticated", user: session.user, role });
    });

    return () => subscription.unsubscribe();
  }, []);

  return state;
}

async function resolveRole(
  authUserId: string,
  email: string
): Promise<"organizer" | "participant" | "unknown"> {
  // Check if user is an organizer
  const { data: organizer } = await supabase
    .from("organizers")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (organizer) return "organizer";

  // Check if user is a participant
  const { data: participant } = await supabase
    .from("participants")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  // Also check if their email matches a participant record (first-time login)
  if (!participant) {
    const { data: matched } = await supabase
      .from("participants")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (matched) {
      // Link the auth user ID to the participant record
      await supabase
        .from("participants")
        .update({ auth_user_id: authUserId })
        .eq("id", matched.id);
      return "participant";
    }
  }

  if (participant) return "participant";

  return "unknown";
}

export function useCurrentParticipant() {
  const [participant, setParticipant] = useState<Tables<"participants"> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("participants")
        .select("*")
        .eq("auth_user_id", session.user.id)
        .maybeSingle();

      setParticipant(data);
      setLoading(false);
    });
  }, []);

  return { participant, loading };
}
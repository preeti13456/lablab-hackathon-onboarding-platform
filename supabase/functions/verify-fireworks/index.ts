import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * verify-fireworks — Promo Code Info
 *
 * Returns the Fireworks promo code instructions for hackathon participants.
 * Participants visit https://devcloud.amd.com/, request a promo code,
 * and receive it via email. No API key validation is needed — the user
 * self-reports receiving the promo code in the onboarding wizard.
 */

Deno.serve(async (req: Request) => {
  // Only accept GET
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      instructions: {
        step1: "Visit https://devcloud.amd.com/ and sign in or create an account.",
        step2: "Request a Fireworks promo code from the AMD DevCloud dashboard.",
        step3: "Check your email for the promo code. You'll use it to claim credits on Fireworks.",
        step4: "Once you have the promo code, redeem it at https://fireworks.ai/ to activate your credits.",
      },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});

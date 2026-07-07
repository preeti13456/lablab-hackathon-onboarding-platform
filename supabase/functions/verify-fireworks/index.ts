import "jsr:@supabase/functions-js/edge-runtime.d.ts";

interface VerifyRequest {
  api_key: string;
}

Deno.serve(async (req: Request) => {
  // Only accept POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Parse and validate body
  let body: VerifyRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!body.api_key || typeof body.api_key !== "string" || !body.api_key.trim()) {
    return new Response(JSON.stringify({ error: "Missing or invalid api_key" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Test the Fireworks API key by making a /v1/models request
  try {
    const response = await fetch("https://api.fireworks.ai/v1/models", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${body.api_key.trim()}`,
        "Content-Type": "application/json",
      },
    });

    if (response.ok) {
      return new Response(
        JSON.stringify({ valid: true, message: "Fireworks API key is valid" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (response.status === 401 || response.status === 403) {
      return new Response(
        JSON.stringify({ valid: false, message: "Invalid API key — check your key and try again" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Other error
    const errorText = await response.text().catch(() => "Unknown error");
    return new Response(
      JSON.stringify({
        valid: false,
        message: `Fireworks API returned status ${response.status}. Try again later.`,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("verify-fireworks error:", err);
    return new Response(
      JSON.stringify({ valid: false, message: "Could not reach Fireworks API — check your internet connection" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
});
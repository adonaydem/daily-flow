import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SummarizeProjectInput {
  project_name: string;
  tasks: Array<{
    task_title: string;
    deliverables: string; // already structured or raw text
    reports: string; // concatenated reports text
  }>;
}

// Approx token heuristic: 1 token ~ 4 chars English. We'll cap pre-summarization payload.
const MAX_INPUT_TOKENS = 3500; // generous limit below typical 4k tokens for flash model

function truncateForTokenLimit(str: string, remainingTokens: { value: number }): string {
  if (remainingTokens.value <= 0) return "";
  const approxTokens = Math.ceil(str.length / 4);
  if (approxTokens <= remainingTokens.value) {
    remainingTokens.value -= approxTokens;
    return str;
  }
  // Need to slice characters proportionally
  const allowedChars = remainingTokens.value * 4;
  const sliced = str.slice(0, allowedChars);
  remainingTokens.value = 0;
  return sliced + "\n...[truncated]";
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as SummarizeProjectInput;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (!body || typeof body.project_name !== 'string' || !Array.isArray(body.tasks)) {
      return new Response(JSON.stringify({ error: "Invalid JSON schema: expected { project_name: string, tasks: Task[] }" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.tasks.length === 0) {
      return new Response(JSON.stringify({ error: "No tasks provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Order tasks are expected most-recent-first already; enforce max 10
    const tasks = body.tasks.slice(0, 10);

    const remainingTokens = { value: MAX_INPUT_TOKENS };
    const taskBlocks: string[] = [];

    for (const t of tasks) {
      const titlePart = truncateForTokenLimit(`TITLE: ${t.task_title}\n`, remainingTokens);
      const deliverablePart = truncateForTokenLimit(`DELIVERABLES: ${t.deliverables}\n`, remainingTokens);
      const reportsPart = truncateForTokenLimit(t.reports ? `REPORTS: ${t.reports}\n` : "", remainingTokens);
      taskBlocks.push(`${titlePart}${deliverablePart}${reportsPart}`.trim());
      if (remainingTokens.value <= 0) break;
    }

    const assembled = taskBlocks.join("\n\n");

    const systemPrompt = `You are a senior project assistant. Produce a concise catch-up summary for the project. Structure sections: 1) Recent Accomplishments 2) Active / Pending Items 3) Risks / Blockers 4) Suggested Next Steps. Keep it under 400 words. Preserve factual details; do not fabricate. Use markdown headings and bullet points. Most recent tasks are first in the input.`;

    const userPrompt = `Project: ${body.project_name}\n\nContext (truncated to token budget):\n\n${assembled}`;

    let response: Response;
    try {
      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: 800,
          temperature: 0.4,
        }),
      });
    } catch (apiErr) {
      console.error('summarize-project fetch error:', apiErr);
      return new Response(JSON.stringify({ error: 'Upstream fetch failed' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI summarize-project error", response.status, errText);
      return new Response(JSON.stringify({ error: "AI gateway error", status: response.status }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ summary }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("summarize-project error (outer):", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error (outer)" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const corsHeaders: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin",
};

async function callOpenAI({
  model = "gpt-4o-mini",
  messages,
  max_tokens = 800,
  temperature = 0.4,
}: {
  model?: string;
  messages: unknown[];
  max_tokens?: number;
  temperature?: number;
}) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages, max_tokens, temperature }),
  });
  if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const { action, payload } = await req.json();

      if (action === "structureText") {
        const raw = payload?.text ?? payload?.raw ?? "";
        const messages = [
          { role: "system", content: "You format unstructured text into concise professional bullet points. Output only the bullet list." },
          { role: "user", content: raw },
        ];
        const structured = await callOpenAI({ messages, max_tokens: 600, temperature: 0.3 });
        return new Response(JSON.stringify({ result: { structured_text: structured } }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "summarizeProject") {
        const projectName = payload?.project_name ?? payload?.projectName ?? "Project";
        const context = payload?.context ?? "";
        const instructions =
          payload?.instructions ??
          "Produce sections: 1) Recent Accomplishments 2) Active / Pending 3) Risks / Blockers 4) Suggested Next Steps. Under 400 words. Use markdown headings showing dates and bullet lists with concise description.";

        const messages = [
          { role: "system", content: "You are a senior project assistant." },
          { role: "user", content: `Project: ${projectName}\n\nInstructions:\n${instructions}\n\nContext:\n${context}` },
        ];
        const summary = await callOpenAI({ messages, max_tokens: 800, temperature: 0.4 });
        return new Response(JSON.stringify({ result: { summary } }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Unknown JSON action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const action = formData.get("action");
      if (action !== "transcribeAudio") {
        return new Response(JSON.stringify({ error: "Unknown multipart action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const file = formData.get("file") as File | null;
      const language = (formData.get("language") as string | null) ?? "en";
      if (!file) throw new Error("Missing audio file");

      const whisperForm = new FormData();
      whisperForm.append("file", file, file.name);
      whisperForm.append("model", "whisper-1");
      whisperForm.append("response_format", "verbose_json");
      whisperForm.append("language", language);

      const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
        body: whisperForm,
      });
      if (!resp.ok) throw new Error(`Whisper error ${resp.status}: ${await resp.text()}`);
      const data = await resp.json();

      return new Response(JSON.stringify({ result: data.text ?? "" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unsupported content type" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

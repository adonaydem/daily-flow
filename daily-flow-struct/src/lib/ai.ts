import { supabase } from "@/integrations/supabase/client";

export async function callEdge(action: string, payload: any) {
  // Ensure user is authenticated (invoke will send auth if available)
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const { data, error } = await supabase.functions.invoke("openai-functions", {
    body: { action, payload },
  });

  if (error) throw new Error(error.message || "Function call failed");
  return (data as any)?.result;
}




export async function structureText(raw: string): Promise<string> {
  if (!raw || raw.trim().length === 0) return '';
  const result = await callEdge('structureText', { text: raw });
  return result.structured_text || '';
}

interface SummarizeInputTask { task_title: string; deliverables: string; reports: string; }
export async function summarizeProject(projectName: string, tasks: SummarizeInputTask[]): Promise<string> {
  const limited = tasks.slice(0, 10); // enforce max 10
  const context = limited.map(t => `TITLE: ${t.task_title}\nDELIVERABLES: ${t.deliverables}\n${t.reports ? 'REPORTS: ' + t.reports : ''}`).join('\n\n');
  // crude token cap
  const capChars = 16000; // ~4 chars per token -> ~4k tokens
  const trimmed = context.length > capChars ? context.slice(0, capChars) + '\n...[truncated]' : context;
  const payload = {
    project_name: projectName,
    context: trimmed,
    instructions: 'Produce sections: 1) Recent Accomplishments 2) Active / Pending 3) Risks / Blockers 4) Suggested Next Steps. Under 400 words. Use markdown headings showing dates and bullet lists with concise description.'
  };
  const result = await callEdge('summarizeProject', payload);
  return result.summary || '';
}

export async function transcribeAudio(blob: Blob, language = "en") {
  const form = new FormData();
  form.append("action", "transcribeAudio");
  form.append("file", blob, "audio.webm");
  form.append("language", language);

  const { data, error } = await supabase.functions.invoke("openai-functions", {
    body: form,
  });
  if (error) throw new Error(error.message || "Transcription failed");
  return (data as any).result as string;
}


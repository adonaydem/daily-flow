import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { Project, Deliverable } from "@/types/database";
// Replaced legacy browser STT with OpenAI Whisper
import { useWhisper } from "@/hooks/useWhisper";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { structureText } from "@/lib/ai";
import { toast } from "sonner";
import { Wand2, Undo2 } from "lucide-react";

interface DeliverableModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  date: Date;
  onDeliverableCreated: () => void;
  existingDeliverable?: {
    id: string;
    raw_text: string;
    structured_text?: string;
    title?: string | null;
    notes?: string | null;
    tag: string | null;
    color_override: string | null;
  };
  deliverable?: Deliverable;
  onComplete?: () => void;
}

export const DeliverableModal = ({
  open,
  onOpenChange,
  project,
  date,
  onDeliverableCreated,
  existingDeliverable,
  deliverable,
  onComplete,
}: DeliverableModalProps) => {
  const [title, setTitle] = useState(existingDeliverable?.title || "");
  const [deliverables, setDeliverables] = useState(existingDeliverable?.raw_text || "");
  const [notes, setNotes] = useState(existingDeliverable?.notes || "");
  const [tag, setTag] = useState(existingDeliverable?.tag || "");
  const [colorOverride, setColorOverride] = useState(existingDeliverable?.color_override || "");
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPreview, setAiPreview] = useState<string | null>(null);
  const [appliedStructured, setAppliedStructured] = useState<string | null>(null);
  const [prevStructured, setPrevStructured] = useState<string | null>(existingDeliverable?.structured_text || null);

  const { start, stop, recording, uploading, result, reset } = useWhisper({ autoStopMs: 90000 });
  useEffect(() => {
    if (result.transcript) {
      setDeliverables(prev => prev ? prev + "\n" + result.transcript : result.transcript);
    }
  }, [result.transcript]);

  // Reset fields and transcripts when dialog opens/closes or target changes
  useEffect(() => {
    if (open) {
      setTitle(existingDeliverable?.title || "");
      setDeliverables(existingDeliverable?.raw_text || "");
      setNotes(existingDeliverable?.notes || "");
      setTag(existingDeliverable?.tag || "");
      setColorOverride(existingDeliverable?.color_override || project.color || "");
      setAiPreview(null);
      setAppliedStructured(null);
      setPrevStructured(existingDeliverable?.structured_text || null);
      reset();
    } else {
      // stop any recording and clear transcript on close
      try { stop(); } catch {}
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existingDeliverable?.id]);

  const handleSave = async () => {
    setLoading(true);

    try {
  // Use approved AI result if applied, otherwise keep raw as structured (no auto-structuring)
  const structuredText = appliedStructured ?? prevStructured ?? deliverables;

      if (existingDeliverable) {
        // Update existing deliverable
        const { error } = await supabase
          .from("deliverables")
          .update({
            title: title || null,
            raw_text: deliverables,
            structured_text: structuredText,
            notes: notes || null,
            tag: tag || null,
            color_override: colorOverride || null,
          })
          .eq("id", existingDeliverable.id);

        if (error) throw error;
        toast.success("Deliverable updated!");
      } else {
        // Create new deliverable
        const { error } = await supabase.from("deliverables").insert({
          project_id: project.id,
          date: format(date, "yyyy-MM-dd"),
          title: title || null,
          raw_text: deliverables,
          structured_text: structuredText,
          // notes intentionally omitted on creation per requirement
          tag: tag || null,
          color_override: colorOverride || project.color,
        });

        if (error) throw error;
        toast.success("Deliverable created!");
      }

      setTitle("");
      setDeliverables("");
      setNotes("");
      setTag("");
      setColorOverride("");
      onOpenChange(false);
      onDeliverableCreated();
    } catch (error) {
      console.error("Error saving deliverable:", error);
      toast.error("Failed to save deliverable");
    } finally {
      setLoading(false);
    }
  };

  const handleAIPreview = async () => {
    try {
      setAiLoading(true);
      const structured = await structureText(deliverables);
      setAiPreview(structured || "");
    } catch (e) {
      console.error(e);
      toast.error("AI transform failed");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            {existingDeliverable ? "Edit Deliverable" : "New Deliverable"}
          </DialogTitle>
          <div className="text-sm text-muted-foreground mt-2">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: project.color }}
              />
              <span className="font-medium">{project.name}</span>
              <span>•</span>
              <span>{format(date, "EEEE, MMMM d, yyyy")}</span>
            </div>
          </div>
        </DialogHeader>

  <div className="space-y-4 overflow-auto pr-1 max-h-[70vh]">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" placeholder="Short title" value={title || ''} onChange={(e)=>setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="deliverables">Deliverables</Label>
            <div className="relative">
              <Textarea
                id="deliverables"
                placeholder="Enter your deliverables here... (will be structured by AI)"
                value={deliverables}
                onChange={(e) => setDeliverables(e.target.value)}
                rows={10}
                className="resize-none pr-12"
              />
              <div className="absolute top-2 right-2 flex gap-2">
                <button
                  type="button"
                  onClick={handleAIPreview}
                  className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-medium shadow-sm transition ${aiLoading ? 'bg-secondary' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}
                  aria-label="AI preview"
                  disabled={aiLoading}
                  title="Preview AI transformation"
                >
                  {aiLoading ? '…' : <Wand2 className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={recording ? stop : start}
                  className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-medium shadow-sm transition
                    ${recording ? 'bg-destructive text-destructive-foreground animate-pulse' : 'bg-secondary hover:bg-secondary/80'}`}
                  aria-label={recording ? 'Stop recording' : 'Start recording'}
                  disabled={uploading}
                >
                  {recording ? '◼' : (uploading ? '…' : '🎤')}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span>{recording ? 'Recording…' : uploading ? 'Transcribing…' : 'Click mic to dictate (Whisper)'}</span>
              {result.transcript && <button type="button" onClick={reset} className="underline hover:text-foreground">Clear transcript</button>}
            </div>
            <p className="text-xs text-muted-foreground">Use the wand to preview AI structure, then apply before saving. If you skip, we'll save as-is.</p>
            {aiPreview !== null && (
              <div className="mt-2 border rounded-md p-3 bg-muted/40">
                <div className="text-xs font-medium mb-2">AI Preview</div>
                <pre className="text-xs whitespace-pre-wrap max-h-48 overflow-auto">{aiPreview}</pre>
                <div className="flex gap-2 mt-2">
                  <Button size="sm" onClick={() => { setAppliedStructured(aiPreview); toast.success('AI result applied'); }}>Apply</Button>
                  <Button size="sm" variant="outline" onClick={() => setAiPreview(null)}>Dismiss</Button>
                  {prevStructured && (
                    <Button size="sm" variant="ghost" onClick={() => { setAppliedStructured(null); setAiPreview(null); toast.message('Reverted to previous structure'); }}>
                      <Undo2 className="w-4 h-4 mr-1" />Undo
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          {existingDeliverable && (
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" placeholder="Quick notes before concluding..." value={notes || ''} onChange={(e)=>setNotes(e.target.value)} rows={4} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tag">Tag (Optional)</Label>
              <Input
                id="tag"
                placeholder="e.g., Sprint 1"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="color">Color Override (Optional)</Label>
              <Input
                id="color"
                type="color"
                value={colorOverride || project.color}
                onChange={(e) => setColorOverride(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading || !deliverables.trim()}
              className="flex-1"
            >
              {loading ? "Saving..." : existingDeliverable ? "Update" : "Save"}
            </Button>
          </div>

          {/* Legacy deliverable detail section removed (fields not present in current schema). */}
        </div>
      </DialogContent>
    </Dialog>
  );
};

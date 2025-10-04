import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { Deliverable } from "@/types/database";
import { supabase } from "@/integrations/supabase/client";
import { structureText } from "@/lib/ai";
import { toast } from "sonner";
import { useWhisper } from "@/hooks/useWhisper";

interface AddReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deliverable: Deliverable;
  onReportAdded: () => void;
}

export const AddReportDialog = ({
  open,
  onOpenChange,
  deliverable,
  onReportAdded,
}: AddReportDialogProps) => {
  const [report, setReport] = useState("");
  const [loading, setLoading] = useState(false);
  const { start, stop, recording, uploading, result, reset } = useWhisper({ autoStopMs: 60000 });

  useEffect(() => {
    if (result.transcript) {
      setReport(prev => prev ? prev + "\n" + result.transcript : result.transcript);
    }
  }, [result.transcript]);

  const handleSave = async () => {
    setLoading(true);

    try {
      const structuredText = await structureText(report);

      const { error } = await supabase.from("reports").insert({
        deliverable_id: deliverable.id,
        raw_text: report,
        structured_text: structuredText,
      });

      if (error) throw error;

      toast.success("Report added!");
      setReport("");
      onOpenChange(false);
      onReportAdded();
    } catch (error) {
      console.error("Error adding report:", error);
      toast.error("Failed to add report");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Report</DialogTitle>
          <p className="text-sm text-muted-foreground mt-2">
            What actually happened with this deliverable?
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <p className="text-sm font-medium mb-1">Original Deliverable:</p>
            <p className="text-xs text-muted-foreground whitespace-pre-wrap">
              {deliverable.structured_text}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="report">Report</Label>
            <div className="relative">
              <Textarea
                id="report"
                placeholder="Describe what happened, outcomes, blockers, etc... (will be structured by AI)"
                value={report}
                onChange={(e) => setReport(e.target.value)}
                rows={8}
                className="resize-none pr-12"
              />
              <button
                type="button"
                onClick={recording ? stop : start}
                disabled={uploading}
                className={`absolute top-2 right-2 h-9 w-9 rounded-full flex items-center justify-center text-xs font-medium shadow-sm transition
                  ${recording ? 'bg-destructive text-destructive-foreground animate-pulse' : 'bg-secondary hover:bg-secondary/80'}`}
                aria-label={recording ? 'Stop recording' : 'Start recording'}
              >
                {recording ? '◼' : (uploading ? '…' : '🎤')}
              </button>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span>{recording ? 'Recording…' : uploading ? 'Transcribing…' : 'Click mic to dictate (Whisper)'}</span>
              {result.transcript && <button type="button" onClick={reset} className="underline hover:text-foreground">Clear transcript</button>}
            </div>
            <p className="text-xs text-muted-foreground">
              Your text will be automatically structured into bullet points by AI
            </p>
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
              disabled={loading || !report.trim()}
              className="flex-1"
            >
              {loading ? "Saving..." : "Add Report"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

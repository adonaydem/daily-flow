import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { Project } from "@/types/database";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DeliverableModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  date: Date;
  onDeliverableCreated: () => void;
  existingDeliverable?: {
    id: string;
    raw_text: string;
    tag: string | null;
    color_override: string | null;
  };
}

export const DeliverableModal = ({
  open,
  onOpenChange,
  project,
  date,
  onDeliverableCreated,
  existingDeliverable,
}: DeliverableModalProps) => {
  const [deliverables, setDeliverables] = useState(existingDeliverable?.raw_text || "");
  const [tag, setTag] = useState(existingDeliverable?.tag || "");
  const [colorOverride, setColorOverride] = useState(existingDeliverable?.color_override || "");
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);

    try {
      // Call edge function to structure text
      const { data: structureData, error: structureError } = await supabase.functions.invoke(
        "structure-text",
        {
          body: { text: deliverables },
        }
      );

      if (structureError) throw structureError;

      const structuredText = structureData.structuredText;

      if (existingDeliverable) {
        // Update existing deliverable
        const { error } = await supabase
          .from("deliverables")
          .update({
            raw_text: deliverables,
            structured_text: structuredText,
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
          raw_text: deliverables,
          structured_text: structuredText,
          tag: tag || null,
          color_override: colorOverride || project.color,
        });

        if (error) throw error;
        toast.success("Deliverable created!");
      }

      setDeliverables("");
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
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

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="deliverables">Deliverables</Label>
            <Textarea
              id="deliverables"
              placeholder="Enter your deliverables here... (will be structured by AI)"
              value={deliverables}
              onChange={(e) => setDeliverables(e.target.value)}
              rows={8}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Your text will be automatically structured into bullet points by AI
            </p>
          </div>

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
        </div>
      </DialogContent>
    </Dialog>
  );
};

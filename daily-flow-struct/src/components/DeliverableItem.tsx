import { useState } from "react";
import { Deliverable } from "@/types/database";
import { Check, Edit2, FileText } from "lucide-react";
import { Button } from "./ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AddReportDialog } from "./AddReportDialog";
import { DeliverableModal } from "./DeliverableModal";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface DeliverableItemProps {
  deliverable: Deliverable;
  onUpdated: () => void;
}

export const DeliverableItem = ({ deliverable, onUpdated }: DeliverableItemProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const handleToggleDone = async () => {
    try {
      const { error } = await supabase
        .from("deliverables")
        .update({ is_done: !deliverable.is_done })
        .eq("id", deliverable.id);

      if (error) throw error;
      toast.success(deliverable.is_done ? "Marked as not done" : "Marked as done");
      onUpdated();
    } catch (error) {
      console.error("Error toggling done:", error);
      toast.error("Failed to update status");
    }
  };

  const color = deliverable.color_override || deliverable.project?.color || "#8B5CF6";

  return (
    <>
      <div className="group relative">
        <div
          className={`p-3 rounded-lg border transition-all cursor-pointer hover:shadow-md ${
            deliverable.is_done
              ? "bg-muted/50 border-muted"
              : "bg-background border-border"
          }`}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-start gap-2">
            <div
              className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
              style={{ backgroundColor: color }}
            />
            <div className="flex-1 min-w-0">
              <div className={`text-sm ${deliverable.is_done ? "line-through opacity-60" : ""}`}>
                {deliverable.structured_text.split("\n")[0].replace(/^[•\-\*]\s*/, "")}
              </div>
              {deliverable.tag && (
                <div className="text-xs text-muted-foreground mt-1">
                  {deliverable.tag}
                </div>
              )}
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleDone();
                }}
                className="h-6 w-6 p-0"
              >
                <Check className={`w-3 h-3 ${deliverable.is_done ? "text-green-500" : ""}`} />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditOpen(true);
                }}
                className="h-6 w-6 p-0"
              >
                <Edit2 className="w-3 h-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsReportOpen(true);
                }}
                className="h-6 w-6 p-0"
              >
                <FileText className="w-3 h-3" />
              </Button>
            </div>
          </div>

          {isExpanded && (
            <div className="mt-2 prose prose-xs dark:prose-invert max-w-none text-muted-foreground">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {deliverable.structured_text || deliverable.raw_text || ""}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>

      <AddReportDialog
        open={isReportOpen}
        onOpenChange={setIsReportOpen}
        deliverable={deliverable}
        onReportAdded={onUpdated}
      />

      {deliverable.project && (
        <DeliverableModal
          open={isEditOpen}
          onOpenChange={setIsEditOpen}
          project={deliverable.project}
          date={new Date(deliverable.date)}
          onDeliverableCreated={onUpdated}
          existingDeliverable={{
            id: deliverable.id,
            raw_text: deliverable.raw_text,
            tag: deliverable.tag,
            color_override: deliverable.color_override,
          }}
        />
      )}
    </>
  );
};

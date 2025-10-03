import { format, isToday } from "date-fns";
import { Badge } from "./ui/badge";
import { Deliverable } from "@/types/database";
import { useDroppable } from "@dnd-kit/core";
import { DeliverableItem } from "./DeliverableItem";

interface DateTileProps {
  date: Date;
  deliverables: Deliverable[];
  onDeliverableUpdated: () => void;
}

export const DateTile = ({ date, deliverables, onDeliverableUpdated }: DateTileProps) => {
  const dateStr = format(date, "yyyy-MM-dd");
  const { setNodeRef, isOver } = useDroppable({
    id: dateStr,
  });

  const today = isToday(date);

  return (
    <div
      ref={setNodeRef}
      className={`
        min-h-[200px] p-4 rounded-xl border-2 transition-all
        ${isOver ? "border-primary bg-primary/5 scale-105" : "border-border bg-card"}
        ${today ? "ring-2 ring-primary/20" : ""}
      `}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className={`text-xs font-medium ${today ? "text-primary" : "text-muted-foreground"}`}>
            {format(date, "EEE")}
          </div>
          <div className={`text-lg font-bold ${today ? "text-primary" : "text-foreground"}`}>
            {format(date, "d")}
          </div>
        </div>
        {deliverables.length > 0 && (
          <Badge variant="secondary" className="text-xs">
            {deliverables.length}
          </Badge>
        )}
      </div>

      <div className="space-y-2">
        {deliverables.slice(0, 3).map((deliverable) => (
          <DeliverableItem
            key={deliverable.id}
            deliverable={deliverable}
            onUpdated={onDeliverableUpdated}
          />
        ))}
        {deliverables.length > 3 && (
          <div className="text-xs text-muted-foreground text-center py-1">
            +{deliverables.length - 3} more
          </div>
        )}
      </div>
    </div>
  );
};

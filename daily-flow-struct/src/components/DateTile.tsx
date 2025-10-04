import { format, isToday } from "date-fns";
import { Deliverable } from "@/types/database";
import { useDroppable } from "@dnd-kit/core";
// Removed react-markdown for previews to show plain snippet

interface DateTileProps {
  date: Date;
  deliverables: Deliverable[];
  onDeliverableUpdated: () => void;
  onDeliverableClick: (deliverable: Deliverable) => void;
}

export const DateTile = ({ date, deliverables, onDeliverableUpdated, onDeliverableClick }: DateTileProps) => {
  const dateStr = format(date, "yyyy-MM-dd");
  const today = isToday(date);
  const isPast = date < new Date(new Date().setHours(0,0,0,0));
  const { setNodeRef, isOver } = useDroppable({ id: dateStr, disabled: isPast });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[200px] p-4 rounded-md border transition-all select-none
        ${isOver && !isPast ? "border-primary bg-primary/5" : "border-border bg-card"}
        ${today ? "ring-2 ring-primary/20" : ""}
        ${isPast ? "opacity-60" : ""}`}
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
      </div>

      <div className="space-y-2">
        {deliverables.map((deliverable) => {
          const accent = deliverable.project?.color || deliverable.color_override || '#2d3748';
          const rawLine = (deliverable.structured_text || '').split('\n').find(l=>l.trim()) || deliverable.raw_text || '';
          const firstPara = rawLine
            .replace(/^#{1,6}\s+/,'') // headings
            .replace(/[*_`~>\-]/g,'') // common markdown chars
            .replace(/\[(.*?)\]\((.*?)\)/g,'$1') // links
            .slice(0,160);
          return (
            <div
              key={deliverable.id}
              className="relative cursor-pointer p-2 rounded bg-muted/70 hover:bg-muted transition-colors group border border-border/40 flex gap-2"
              onClick={() => onDeliverableClick(deliverable)}
            >
              <div className="w-1 rounded-sm" style={{ background: accent }} />
              <div className="flex-1 min-w-0">
                {deliverable.title && (
                  <p className="text-xs font-semibold mb-1 truncate" style={{ color: accent }}>{deliverable.title}</p>
                )}
                <p className="text-[11px] leading-snug text-muted-foreground line-clamp-3 whitespace-pre-wrap">{firstPara}</p>
              </div>
              {deliverable.is_done && (
                <div className="absolute top-1 right-1 text-green-500/90 bg-background/70 rounded-full w-4 h-4 flex items-center justify-center text-[10px] border border-green-500/40 shadow-sm">
                  ✓
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
